import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Trip, Vehicle, Driver, WorkRecord } from '@/types';
import { RefreshCw, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

declare global {
  interface Window { L: any; }
}

const MONITOR_COLORS = {
  bg: '#0B1437',
  card: '#0F1F4A',
  accent: '#00E5FF',
  active: '#00BFA5',
  parkedLate: '#FF6D00',
  workshop: '#F57C00',
  offline: '#B71C1C',
  inProgress: '#1565C0',
  border: '#1E3A5F',
  textDim: '#94A3B8',
  rowAlt: '#0D1B47',
};

const SUB_ACCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'mcl', label: 'MCL' },
  { value: 'tarmal', label: 'TARMAL' },
  { value: 'csl', label: 'CSL' },
  { value: 'mushroom', label: 'MUSHROOM' },
];

const GEOFENCES = [
  { name: 'MCL / Mikindani', color: '#FFEB3B', coords: [[-3.9670, 39.7330], [-3.9670, 39.7600], [-3.9500, 39.7600], [-3.9500, 39.7330]] },
  { name: 'Ngamani New', color: '#4CAF50', coords: [[-3.9800, 39.7500], [-3.9800, 39.7800], [-3.9650, 39.7800], [-3.9650, 39.7500]] },
  { name: 'Workshop', color: '#FF9800', coords: [[-3.9550, 39.7450], [-3.9550, 39.7620], [-3.9420, 39.7620], [-3.9420, 39.7450]] },
];

const MOMBASA_CENTER: [number, number] = [-3.9630, 39.7500];

type TripWithRelations = Trip & { vehicle?: Vehicle | null; driver?: Driver | null };
type WorkRecordWithVehicle = WorkRecord & { vehicle?: Vehicle | null };

type UnitStatus = {
  vehicle: Vehicle;
  badges: { label: string; color: string; sublabel?: string }[];
  tripsToday: TripWithRelations[];
  avgTripTime: number | null;
  lastActivity: string | null;
  totalDistance: number;
  currentDriver?: Driver | null;
  activeWorkRecord?: WorkRecord | null;
};

type CardKey = 'trips_today' | 'inside_mcl' | 'towards_mcl' | 'inside_workshop' | 'towards_ngamani' | 'parked_late' | 'stopped_outside' | 'offline' | 'latest_trip';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}M`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}H ${m}M`;
}

function parseTimeToMinutes(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isStale(lastUpdate: Date | null, now: Date): boolean {
  if (!lastUpdate) return true;
  return (now.getTime() - lastUpdate.getTime()) > 5 * 60 * 1000;
}

export function LiveMonitor({ color, subAccountFilter: forcedFilter }: { color: string; subAccountFilter?: string }) {
  const { profile } = useAuth();
  const [now, setNow] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [nextRefresh, setNextRefresh] = useState(300);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TripWithRelations[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workRecords, setWorkRecords] = useState<WorkRecordWithVehicle[]>([]);
  const [subFilter, setSubFilter] = useState<string>('all');
  const [activeCard, setActiveCard] = useState<CardKey | null>(null);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripWithRelations | null>(null);
  const [mapToggle, setMapToggle] = useState<'satellite' | 'map'>('map');
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const layersRef = useRef<any[]>([]);

  const isMaster = profile?.sub_account === 'master' || profile?.sub_account === null;
  const effectiveFilter = forcedFilter ?? (isMaster ? subFilter : profile?.sub_account ?? 'all');

  // Clock ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setNextRefresh(prev => prev > 0 ? prev - 1 : 300);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = now.toISOString().slice(0, 10);

  const loadData = useCallback(async () => {
    setLoading(true);
    const filter = effectiveFilter;
    let tripQuery = supabase.from('trips').select('*, vehicle:vehicles(*), driver:drivers(*)').eq('trip_date', todayStr);
    let vehicleQuery = supabase.from('vehicles').select('*');
    let workQuery = supabase.from('work_records').select('*, vehicle:vehicles(*)').eq('work_date', todayStr);

    if (filter !== 'all') {
      tripQuery = (tripQuery as any).eq('sub_account', filter);
      vehicleQuery = (vehicleQuery as any).eq('sub_account', filter);
      workQuery = (workQuery as any).eq('sub_account', filter);
    }

    const [tripRes, vehicleRes, workRes] = await Promise.all([
      tripQuery,
      vehicleQuery,
      workQuery,
    ]);

    setTrips((tripRes.data as any) || []);
    setVehicles((vehicleRes.data as any) || []);
    setWorkRecords((workRes.data as any) || []);
    setLastUpdate(new Date());
    setNextRefresh(300);
    setLoading(false);
  }, [effectiveFilter, todayStr]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Build unit statuses
  const unitStatuses: UnitStatus[] = useMemo(() => {
    return vehicles.map(vehicle => {
      const vTrips = trips.filter(t => t.vehicle_id === vehicle.id);
      const completedTrips = vTrips.filter(t => t.status === 'completed');
      const inProgressTrips = vTrips.filter(t => t.status === 'in_progress' || t.status === 'started');
      const vWorkRecords = workRecords.filter(w => w.vehicle_id === vehicle.id);
      const activeWork = vWorkRecords.find(w => w.status === 'in_progress' || w.status === 'pending');

      const badges: { label: string; color: string; sublabel?: string }[] = [];

      // Inside MCL
      const mclTrip = inProgressTrips.find(t => (t.destination || t.to_location || '').includes('MCL'));
      if (mclTrip) {
        const since = parseTimeToMinutes(mclTrip.arrival_time || mclTrip.departure_time);
        badges.push({ label: 'INSIDE MCL', color: MONITOR_COLORS.active, sublabel: since ? `since ${minutesToHHMM(since)}` : undefined });
      }

      // Towards MCL
      const towardsMcl = inProgressTrips.find(t => (t.destination || t.to_location || '').includes('MCL') && !mclTrip);
      if (towardsMcl && !mclTrip) {
        badges.push({ label: 'TOWARDS MCL', color: MONITOR_COLORS.inProgress });
      }

      // Inside Ngamani
      const ngamaniTrip = inProgressTrips.find(t => (t.destination || t.to_location || '').toLowerCase().includes('ngamani'));
      if (ngamaniTrip) {
        badges.push({ label: 'INSIDE NGAMANI', color: MONITOR_COLORS.active });
      }

      // Towards Ngamani
      const towardsNgamani = inProgressTrips.find(t => (t.destination || t.to_location || '').toLowerCase().includes('ngamani') && !ngamaniTrip);
      if (towardsNgamani && !ngamaniTrip) {
        badges.push({ label: 'TOWARDS NGAMANI', color: MONITOR_COLORS.inProgress });
      }

      // Workshop
      if (activeWork) {
        badges.push({ label: 'INSIDE WORKSHOP', color: MONITOR_COLORS.workshop });
      }

      // Trip durations
      const tripTimes = completedTrips.map(t => {
        const dep = parseTimeToMinutes(t.departure_time);
        const arr = parseTimeToMinutes(t.arrival_time);
        if (dep && arr) return arr - dep;
        return null;
      }).filter((t): t is number => t !== null);
      const avgTrip = tripTimes.length > 0 ? tripTimes.reduce((a, b) => a + b, 0) / tripTimes.length : null;

      // Last activity
      const allTimes = vTrips.flatMap(t => [t.departure_time, t.arrival_time]).filter(Boolean).sort().reverse();
      const lastActivity = allTimes[0] || null;

      // Parked Late: no trips today, last activity before 06:00
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (vTrips.length === 0 && !activeWork) {
        const lastActMin = parseTimeToMinutes(lastActivity);
        if (!lastActMin || lastActMin < 360 || nowMinutes > 360) {
          badges.push({ label: 'PARKED — LATE', color: MONITOR_COLORS.parkedLate, sublabel: 'No activity today' });
        }
      }

      // Stopped outside: in-progress, (now - departure) > 120 min, no arrival
      const stoppedTrip = inProgressTrips.find(t => {
        const dep = parseTimeToMinutes(t.departure_time);
        if (!dep) return false;
        const elapsed = nowMinutes - dep;
        return elapsed > 120 && !t.arrival_time;
      });
      if (stoppedTrip) {
        const dep = parseTimeToMinutes(stoppedTrip.departure_time)!;
        badges.push({ label: `NO SIGNAL ${formatDuration(nowMinutes - dep)}`, color: MONITOR_COLORS.offline });
      }

      // Offline: zero trips today and not in workshop
      if (vTrips.length === 0 && !activeWork && !badges.find(b => b.label.includes('PARKED'))) {
        badges.push({ label: 'NO SIGNAL', color: MONITOR_COLORS.offline });
      }

      const totalDistance = completedTrips.reduce((s, t) => s + (t.distance_km || 0), 0);
      const currentDriver = inProgressTrips[0]?.driver || completedTrips[completedTrips.length - 1]?.driver || null;

      return {
        vehicle,
        badges,
        tripsToday: vTrips,
        avgTripTime: avgTrip,
        lastActivity,
        totalDistance,
        currentDriver,
        activeWorkRecord: activeWork || null,
      };
    });
  }, [vehicles, trips, workRecords, now]);

  // Summary cards data
  const cards = useMemo(() => {
    const completedToday = trips.filter(t => t.status === 'completed');
    const inProgress = trips.filter(t => t.status === 'in_progress' || t.status === 'started');
    const insideMcl = inProgress.filter(t => (t.destination || t.to_location || '').includes('MCL'));
    const towardsMcl = inProgress.filter(t => (t.destination || t.to_location || '').includes('MCL') && !insideMcl.includes(t));
    const insideWorkshop = vehicles.filter(v => workRecords.some(w => w.vehicle_id === v.id && (w.status === 'in_progress' || w.status === 'pending')));
    const towardsNgamani = inProgress.filter(t => (t.destination || t.to_location || '').toLowerCase().includes('ngamani'));
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const parkedLate = vehicles.filter(v => {
      const vTrips = trips.filter(t => t.vehicle_id === v.id);
      const vWork = workRecords.some(w => w.vehicle_id === v.id && (w.status === 'in_progress' || w.status === 'pending'));
      if (vTrips.length > 0 || vWork) return false;
      return true;
    });
    const stoppedOutside = inProgress.filter(t => {
      const dep = parseTimeToMinutes(t.departure_time);
      if (!dep) return false;
      return (nowMin - dep) > 120 && !t.arrival_time;
    });
    const offline = vehicles.filter(v => {
      const vTrips = trips.filter(t => t.vehicle_id === v.id);
      const vWork = workRecords.some(w => w.vehicle_id === v.id && (w.status === 'in_progress' || w.status === 'pending'));
      return vTrips.length === 0 && !vWork;
    });
    const latestTrip = completedToday.sort((a, b) => (b.arrival_time || '').localeCompare(a.arrival_time || ''))[0];

    const platesFor = (vehicleIds: string[]) => vehicles.filter(v => vehicleIds.includes(v.id)).map(v => v.plate_number);
    const platesFromTrips = (tripsArr: Trip[]) => platesFor(tripsArr.map(t => t.vehicle_id).filter(Boolean) as string[]);

    return [
      { key: 'trips_today' as CardKey, label: 'TRIPS TODAY', count: completedToday.length, plates: platesFromTrips(completedToday), borderColor: MONITOR_COLORS.accent },
      { key: 'inside_mcl' as CardKey, label: 'INSIDE MCL', count: insideMcl.length, plates: platesFromTrips(insideMcl), borderColor: MONITOR_COLORS.active },
      { key: 'towards_mcl' as CardKey, label: 'TOWARDS MCL', count: towardsMcl.length, plates: platesFromTrips(towardsMcl), borderColor: MONITOR_COLORS.inProgress },
      { key: 'inside_workshop' as CardKey, label: 'INSIDE WORKSHOP', count: insideWorkshop.length, plates: insideWorkshop.map(v => v.plate_number), borderColor: MONITOR_COLORS.workshop },
      { key: 'towards_ngamani' as CardKey, label: 'TOWARDS NGAMANI', count: towardsNgamani.length, plates: platesFromTrips(towardsNgamani), borderColor: MONITOR_COLORS.inProgress },
      { key: 'parked_late' as CardKey, label: 'PARKED LATE', count: parkedLate.length, plates: parkedLate.map(v => v.plate_number), borderColor: MONITOR_COLORS.parkedLate },
      { key: 'stopped_outside' as CardKey, label: 'STOPPED OUTSIDE', count: stoppedOutside.length, plates: platesFromTrips(stoppedOutside), borderColor: MONITOR_COLORS.parkedLate },
      { key: 'offline' as CardKey, label: 'OFFLINE', count: offline.length, plates: offline.map(v => v.plate_number), borderColor: MONITOR_COLORS.offline },
      { key: 'latest_trip' as CardKey, label: 'LATEST TRIP', count: null, plates: latestTrip ? [latestTrip.vehicle?.plate_number || '—'] : [], latestTrip, borderColor: MONITOR_COLORS.accent },
    ];
  }, [trips, vehicles, workRecords, now]);

  // Filtered unit board based on active card
  const filteredUnits = useMemo(() => {
    if (!activeCard) return unitStatuses;
    return unitStatuses.filter(u => {
      if (activeCard === 'trips_today') return u.tripsToday.some(t => t.status === 'completed');
      if (activeCard === 'inside_mcl') return u.badges.some(b => b.label === 'INSIDE MCL');
      if (activeCard === 'towards_mcl') return u.badges.some(b => b.label === 'TOWARDS MCL');
      if (activeCard === 'inside_workshop') return u.badges.some(b => b.label === 'INSIDE WORKSHOP');
      if (activeCard === 'towards_ngamani') return u.badges.some(b => b.label === 'TOWARDS NGAMANI' || b.label === 'INSIDE NGAMANI');
      if (activeCard === 'parked_late') return u.badges.some(b => b.label.includes('PARKED'));
      if (activeCard === 'stopped_outside') return u.badges.some(b => b.label.includes('NO SIGNAL') && b.label !== 'NO SIGNAL');
      if (activeCard === 'offline') return u.badges.some(b => b.label === 'NO SIGNAL');
      return true;
    });
  }, [unitStatuses, activeCard]);

  // Trip log data
  const tripLog = useMemo(() => {
    const completed = trips.filter(t => t.status === 'completed').sort((a, b) => (b.arrival_time || '').localeCompare(a.arrival_time || ''));
    const inProg = trips.filter(t => t.status === 'in_progress' || t.status === 'started');
    return { completed, inProgress: inProg };
  }, [trips]);

  // Trips by hour chart data
  const tripsByHour = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${String(h).padStart(2, '0')}:00`, trips: 0 }));
    trips.filter(t => t.status === 'completed').forEach(t => {
      const arr = parseTimeToMinutes(t.arrival_time);
      if (arr !== null) {
        const h = Math.floor(arr / 60);
        if (h >= 0 && h < 24) hours[h].trips++;
      }
    });
    return hours;
  }, [trips]);

  const currentHour = now.getHours();

  // Stopped outside data
  const stoppedOutsideTrips = useMemo(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return trips.filter(t => {
      if (t.status !== 'in_progress' && t.status !== 'started') return false;
      const dep = parseTimeToMinutes(t.departure_time);
      if (!dep) return false;
      return (nowMin - dep) > 120 && !t.arrival_time;
    }).map(t => ({
      trip: t,
      stoppedSince: t.departure_time || '—',
      overdueBy: formatDuration(nowMin - (parseTimeToMinutes(t.departure_time) || nowMin)),
      expectedDest: t.destination || t.to_location || '—',
      driver: t.driver?.name || '—',
      plate: t.vehicle?.plate_number || '—',
    }));
  }, [trips, now]);

  // Map initialization with invalidateSize fix
  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstanceRef.current) return;

    mapInstanceRef.current = window.L.map(mapRef.current, {
      center: MOMBASA_CENTER,
      zoom: 14,
      zoomControl: true,
    });

    updateMapTiles();
    drawGeofences();

    // Fix for blank map tiles: recalculate dimensions after render
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  const updateMapTiles = () => {
    if (!mapInstanceRef.current || !window.L) return;
    layersRef.current.forEach(l => mapInstanceRef.current.removeLayer(l));
    layersRef.current = [];

    const tileUrl = mapToggle === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tileLayer = window.L.tileLayer(tileUrl, {
      attribution: mapToggle === 'satellite' ? 'Esri' : 'OpenStreetMap',
      maxZoom: 19,
    });
    tileLayer.addTo(mapInstanceRef.current);
    layersRef.current.push(tileLayer);

    drawGeofences();
    drawMarkers();
  };

  const drawGeofences = () => {
    if (!mapInstanceRef.current || !window.L) return;
    GEOFENCES.forEach(gf => {
      const polygon = window.L.polygon(gf.coords, {
        color: gf.color,
        weight: 2,
        dashArray: '8 4',
        fillOpacity: 0.05,
      });
      polygon.bindTooltip(gf.name, { permanent: false });
      polygon.addTo(mapInstanceRef.current);
      layersRef.current.push(polygon);
    });
  };

  const drawMarkers = () => {
    if (!mapInstanceRef.current || !window.L) return;
    markersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    markersRef.current = [];

    unitStatuses.forEach(u => {
      const hasActive = u.badges.some(b => b.color === MONITOR_COLORS.active || b.color === MONITOR_COLORS.inProgress);
      const isOverdue = u.badges.some(b => b.color === MONITOR_COLORS.offline && b.label.includes('NO SIGNAL') && b.label !== 'NO SIGNAL');
      const isWorkshop = u.badges.some(b => b.label === 'INSIDE WORKSHOP');
      const isParked = u.badges.some(b => b.label.includes('PARKED'));

      let markerColor = MONITOR_COLORS.active;
      if (isOverdue) markerColor = MONITOR_COLORS.offline;
      else if (isWorkshop || isParked) markerColor = MONITOR_COLORS.workshop;

      const seed = u.vehicle.plate_number.charCodeAt(0) || 65;
      const lat = MOMBASA_CENTER[0] + ((seed % 10) - 5) * 0.005;
      const lng = MOMBASA_CENTER[1] + ((seed % 7) - 3) * 0.005;

      const marker = window.L.circleMarker([lat, lng], {
        radius: 8,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.8,
        weight: 2,
      });
      marker.bindPopup(`<b>${u.vehicle.plate_number}</b><br>Driver: ${u.currentDriver?.name || '—'}<br>Status: ${u.badges.map(b => b.label).join(', ') || 'Idle'}<br>Last trip: ${u.lastActivity || '—'}`);
      marker.addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    });

    trips.filter(t => t.status === 'completed').forEach(t => {
      if (t.departure_time && t.arrival_time) {
        const seed = (t.vehicle?.plate_number || 'X').charCodeAt(0) || 65;
        const lat1 = MOMBASA_CENTER[0] + ((seed % 10) - 5) * 0.005;
        const lng1 = MOMBASA_CENTER[1] + ((seed % 7) - 3) * 0.005;
        const lat2 = lat1 + 0.003;
        const lng2 = lng1 + 0.003;
        const line = window.L.polyline([[lat1, lng1], [lat2, lng2]], {
          color: MONITOR_COLORS.accent,
          weight: 2,
          dashArray: '6 4',
          opacity: 0.6,
        });
        line.addTo(mapInstanceRef.current);
        layersRef.current.push(line);
      }
    });
  };

  useEffect(() => {
    if (mapInstanceRef.current) {
      updateMapTiles();
    }
  }, [mapToggle]);

  useEffect(() => {
    if (mapInstanceRef.current && !loading) {
      drawMarkers();
    }
  }, [unitStatuses, loading]);

  const stale = isStale(lastUpdate, now);
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dayStr = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const updatedStr = lastUpdate ? lastUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  const refreshInMin = Math.floor(nextRefresh / 60);
  const refreshInSec = nextRefresh % 60;

  const parkedLateCount = unitStatuses.filter(u => u.badges.some(b => b.label.includes('PARKED'))).length;
  const workshopCount = unitStatuses.filter(u => u.badges.some(b => b.label === 'INSIDE WORKSHOP')).length;
  const noSignalCount = unitStatuses.filter(u => u.badges.some(b => b.label.includes('NO SIGNAL'))).length;

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in" style={{ background: MONITOR_COLORS.bg, minHeight: '80vh', padding: '24px' }}>
        <div className="animate-pulse h-16 rounded-xl" style={{ background: MONITOR_COLORS.card }} />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="animate-pulse h-28 w-48 rounded-xl shrink-0" style={{ background: MONITOR_COLORS.card }} />
          ))}
        </div>
        <div className="animate-pulse h-64 rounded-xl" style={{ background: MONITOR_COLORS.card }} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="animate-pulse h-64 rounded-xl" style={{ background: MONITOR_COLORS.card }} />
          <div className="animate-pulse h-64 rounded-xl" style={{ background: MONITOR_COLORS.card }} />
        </div>
      </div>
    );
  }

  const panelStyle: React.CSSProperties = {
    background: MONITOR_COLORS.card,
    border: `1px solid ${MONITOR_COLORS.border}`,
    borderRadius: '12px',
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: `1px solid ${MONITOR_COLORS.border}`,
    borderLeft: `3px solid ${MONITOR_COLORS.accent}`,
    padding: '10px 16px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  };

  return (
    <div className="space-y-4 animate-fade-in" style={{ background: MONITOR_COLORS.bg, minHeight: '100vh', padding: '20px', color: '#fff', fontFamily: 'monospace' }}>
      {/* SECTION 1: STICKY LIVE HEADER */}
      <div className="sticky top-0 z-10 rounded-xl p-4" style={{ ...panelStyle, borderLeft: `3px solid ${MONITOR_COLORS.accent}` }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold tracking-wider" style={{ color: MONITOR_COLORS.accent }}>{timeStr}</div>
            <div className="text-sm" style={{ color: MONITOR_COLORS.textDim }}>{dayStr} · {dateStr}</div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {!stale && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: MONITOR_COLORS.active }} />}
                <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: stale ? MONITOR_COLORS.parkedLate : MONITOR_COLORS.active }} />
              </span>
              <span className="text-sm font-bold" style={{ color: stale ? MONITOR_COLORS.parkedLate : MONITOR_COLORS.active }}>
                {stale ? 'STALE' : 'LIVE'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs" style={{ color: MONITOR_COLORS.textDim }}>
              UPDATED <span style={{ color: MONITOR_COLORS.accent }}>{updatedStr}</span> · NEXT REFRESH IN <span style={{ color: MONITOR_COLORS.accent }}>{refreshInMin}:{String(refreshInSec).padStart(2, '0')}</span>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors hover:opacity-80"
              style={{ background: MONITOR_COLORS.accent, color: MONITOR_COLORS.bg }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> REFRESH NOW
            </button>
            {isMaster && (
              <select
                value={subFilter}
                onChange={e => setSubFilter(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                style={{ background: MONITOR_COLORS.bg, color: MONITOR_COLORS.accent, border: `1px solid ${MONITOR_COLORS.border}` }}
              >
                {SUB_ACCOUNT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: STATUS SUMMARY CARDS */}
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {cards.map(card => {
          const isActive = activeCard === card.key;
          const isWarning = card.key === 'parked_late' || card.key === 'offline';
          const borderClr = isActive ? MONITOR_COLORS.accent : isWarning ? card.borderColor : MONITOR_COLORS.border;
          return (
            <button
              key={card.key}
              onClick={() => setActiveCard(isActive ? null : card.key)}
              className="shrink-0 w-48 rounded-xl p-3 text-left transition-all hover:scale-[1.02]"
              style={{
                ...panelStyle,
                border: `2px solid ${borderClr}`,
                background: isActive ? `${MONITOR_COLORS.card}` : MONITOR_COLORS.card,
              }}
            >
              <div className="text-xs font-bold mb-1" style={{ color: MONITOR_COLORS.textDim }}>{card.label}</div>
              {card.count !== null ? (
                <div className="text-3xl font-bold mb-1" style={{ color: card.borderColor === MONITOR_COLORS.offline ? MONITOR_COLORS.offline : MONITOR_COLORS.accent }}>{card.count}</div>
              ) : card.latestTrip ? (
                <div className="text-sm font-bold mb-1" style={{ color: MONITOR_COLORS.accent }}>
                  {card.latestTrip.arrival_time || '—'} · {card.latestTrip.vehicle?.plate_number || '—'}
                </div>
              ) : (
                <div className="text-3xl font-bold mb-1" style={{ color: MONITOR_COLORS.textDim }}>—</div>
              )}
              <div className="text-xs truncate" style={{ color: MONITOR_COLORS.textDim }}>
                {card.plates.length > 0 ? card.plates.join(', ') : '—'}
              </div>
            </button>
          );
        })}
      </div>

      {/* SECTION 3: UNIT BOARD */}
      <div style={panelStyle}>
        <div className="flex items-center justify-between" style={headerStyle}>
          <span>UNIT BOARD · CLICK A UNIT TO SEE ITS TRIP TIMES TODAY</span>
          <span style={{ color: MONITOR_COLORS.accent }}>{filteredUnits.length} units</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${MONITOR_COLORS.border}` }}>
                {['#', 'UNIT', 'STATUS', 'TRIPS TODAY', 'AVG TRIP TIME', 'LAST ACTIVITY'].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-xs font-bold" style={{ color: MONITOR_COLORS.textDim }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUnits.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: MONITOR_COLORS.textDim }}>No units match this filter</td></tr>
              )}
              {filteredUnits.map((u, idx) => {
                const isExpanded = expandedUnit === u.vehicle.id;
                const rowBg = idx % 2 === 0 ? MONITOR_COLORS.bg : MONITOR_COLORS.rowAlt;
                return (
                  <Fragment key={u.vehicle.id}>
                    <tr
                      onClick={() => setExpandedUnit(isExpanded ? null : u.vehicle.id)}
                      className="cursor-pointer transition-colors hover:opacity-80"
                      style={{ background: rowBg, borderBottom: `1px solid ${MONITOR_COLORS.border}` }}
                    >
                      <td className="px-3 py-2" style={{ color: MONITOR_COLORS.textDim }}>{idx + 1}</td>
                      <td className="px-3 py-2 font-bold" style={{ color: '#fff' }}>{u.vehicle.plate_number}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {u.badges.map((b, i) => (
                            <span key={i} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${b.color}22`, color: b.color, border: `1px solid ${b.color}44` }}>
                              {b.label}{b.sublabel ? ` (${b.sublabel})` : ''}
                            </span>
                          ))}
                          {u.badges.length === 0 && <span style={{ color: MONITOR_COLORS.textDim }}>—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2" style={{ color: MONITOR_COLORS.accent }}>{u.tripsToday.filter(t => t.status === 'completed').length}</td>
                      <td className="px-3 py-2" style={{ color: MONITOR_COLORS.textDim }}>{u.avgTripTime ? `${Math.round(u.avgTripTime)}M` : '—'}</td>
                      <td className="px-3 py-2" style={{ color: MONITOR_COLORS.textDim }}>{u.lastActivity || '—'}</td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: MONITOR_COLORS.rowAlt }}>
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <div className="text-xs font-bold mb-2" style={{ color: MONITOR_COLORS.accent }}>TRIPS TODAY</div>
                              {u.tripsToday.length === 0 ? (
                                <div className="text-xs" style={{ color: MONITOR_COLORS.textDim }}>No trips today</div>
                              ) : (
                                u.tripsToday.map(t => {
                                  const dep = parseTimeToMinutes(t.departure_time);
                                  const arr = parseTimeToMinutes(t.arrival_time);
                                  const dur = dep && arr ? arr - dep : null;
                                  return (
                                    <div key={t.id} className="text-xs mb-1" style={{ color: '#fff' }}>
                                      {t.departure_time || '—'} → {t.arrival_time || '—'} · {t.origin || t.from_location || '—'} → {t.destination || t.to_location || '—'}
                                      {dur && <span className="ml-2 rounded-full px-1.5 py-0.5 text-xs" style={{ background: `${MONITOR_COLORS.active}22`, color: MONITOR_COLORS.active }}>{dur}M</span>}
                                    </div>
                                  );
                                })
                              )}
                              <div className="text-xs mt-2" style={{ color: MONITOR_COLORS.textDim }}>Distance today: <span style={{ color: MONITOR_COLORS.accent }}>{u.totalDistance} km</span></div>
                            </div>
                            <div>
                              <div className="text-xs font-bold mb-2" style={{ color: MONITOR_COLORS.accent }}>DRIVER & TRAILER</div>
                              <div className="text-xs mb-1" style={{ color: '#fff' }}>Driver: {u.currentDriver?.name || '—'}</div>
                              <div className="text-xs" style={{ color: MONITOR_COLORS.textDim }}>Trailer: {u.vehicle.trailer_number || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold mb-2" style={{ color: MONITOR_COLORS.accent }}>WORK RECORD</div>
                              {u.activeWorkRecord ? (
                                <>
                                  <div className="text-xs mb-1" style={{ color: '#fff' }}>{u.activeWorkRecord.description}</div>
                                  <div className="text-xs" style={{ color: MONITOR_COLORS.textDim }}>Mechanic: {u.activeWorkRecord.performed_by || '—'} · Type: {u.activeWorkRecord.work_type || '—'} · Status: {u.activeWorkRecord.status}</div>
                                </>
                              ) : (
                                <div className="text-xs" style={{ color: MONITOR_COLORS.textDim }}>No active work record</div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs" style={{ borderTop: `1px solid ${MONITOR_COLORS.border}`, color: MONITOR_COLORS.textDim }}>
          {filteredUnits.length} units · {parkedLateCount} parked late · {workshopCount} in workshop · {noSignalCount} no signal
        </div>
      </div>

      {/* SECTION 4: STOPPED OUTSIDE ALLOWED AREAS */}
      <div style={{ ...panelStyle, borderLeft: `3px solid ${MONITOR_COLORS.parkedLate}` }}>
        <div style={headerStyle}>
          <span style={{ color: MONITOR_COLORS.parkedLate }}>STOPPED OUTSIDE ALLOWED AREAS</span>
        </div>
        <div className="overflow-x-auto">
          {stoppedOutsideTrips.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm" style={{ color: MONITOR_COLORS.textDim }}>
              No trucks stopped outside the allowed areas for more than 30 minutes
            </div>
          ) : (
            <table className="w-full text-sm" style={{ fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${MONITOR_COLORS.border}` }}>
                  {['UNIT', 'TRUCK PLATE', 'STOPPED SINCE', 'OVERDUE BY', 'EXPECTED DESTINATION', 'DRIVER'].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-xs font-bold" style={{ color: MONITOR_COLORS.textDim }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stoppedOutsideTrips.map((s, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? MONITOR_COLORS.bg : MONITOR_COLORS.rowAlt, borderBottom: `1px solid ${MONITOR_COLORS.border}` }}>
                    <td className="px-3 py-2 font-bold" style={{ color: '#fff' }}>{s.plate}</td>
                    <td className="px-3 py-2" style={{ color: MONITOR_COLORS.textDim }}>{s.plate}</td>
                    <td className="px-3 py-2" style={{ color: MONITOR_COLORS.parkedLate }}>{s.stoppedSince}</td>
                    <td className="px-3 py-2" style={{ color: MONITOR_COLORS.offline }}>{s.overdueBy}</td>
                    <td className="px-3 py-2" style={{ color: '#fff' }}>{s.expectedDest}</td>
                    <td className="px-3 py-2" style={{ color: MONITOR_COLORS.textDim }}>{s.driver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SECTIONS 5+6+7: BOTTOM GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SECTION 5: TRIP LOG */}
        <div style={panelStyle}>
          <div className="flex items-center justify-between" style={headerStyle}>
            <span>TRIP LOG · {tripLog.completed.length} COMPLETED · {tripLog.inProgress.length} IN PROGRESS</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {tripLog.completed.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: MONITOR_COLORS.textDim }}>No completed trips today</div>
            ) : (
              tripLog.completed.map(t => {
                const dep = parseTimeToMinutes(t.departure_time);
                const arr = parseTimeToMinutes(t.arrival_time);
                const dur = dep && arr ? arr - dep : null;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTrip(t)}
                    className="px-4 py-2 cursor-pointer transition-colors hover:opacity-70"
                    style={{ borderBottom: `1px solid ${MONITOR_COLORS.border}` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold" style={{ color: MONITOR_COLORS.accent }}>{t.arrival_time || '—'}</span>
                        <span className="font-bold" style={{ color: '#fff' }}>{t.vehicle?.plate_number || '—'}</span>
                      </div>
                      {dur && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${MONITOR_COLORS.active}22`, color: MONITOR_COLORS.active }}>
                          TRIP {dur}M
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: MONITOR_COLORS.textDim }}>
                      {(t.origin || t.from_location || '—').toUpperCase()} {t.departure_time || ''} → {(t.destination || t.to_location || '—').toUpperCase()} {t.arrival_time || ''}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECTION 6: TRIPS BY HOUR CHART */}
        <div style={panelStyle}>
          <div style={headerStyle}>TRIPS BY HOUR</div>
          <div className="p-4">
            <ResponsiveBarChart data={tripsByHour} currentHour={currentHour} />
          </div>
        </div>

        {/* SECTION 7: LIVE MAP */}
        <div style={panelStyle} className="lg:col-span-2">
          <div className="flex items-center justify-between" style={headerStyle}>
            <span>LIVE MAP · {unitStatuses.length} UNITS ON MAP</span>
            <button
              onClick={() => setMapToggle(prev => prev === 'map' ? 'satellite' : 'map')}
              className="rounded-lg px-2 py-1 text-xs font-bold transition-colors"
              style={{ background: MONITOR_COLORS.bg, color: MONITOR_COLORS.accent, border: `1px solid ${MONITOR_COLORS.border}` }}
            >
              {mapToggle === 'map' ? 'SATELLITE' : 'MAP'}
            </button>
          </div>
          <div ref={mapRef} style={{ height: '400px', width: '100%', background: MONITOR_COLORS.bg }} />
          <div className="flex flex-wrap items-center gap-4 px-4 py-2 text-xs" style={{ borderTop: `1px solid ${MONITOR_COLORS.border}` }}>
            {[
              { label: 'GEOFENCE', color: '#FFEB3B' },
              { label: 'UNIT NOW', color: MONITOR_COLORS.active },
              { label: 'OVERDUE', color: MONITOR_COLORS.offline },
              { label: 'COMPLETED TRIP', color: MONITOR_COLORS.accent },
              { label: 'WORKSHOP', color: MONITOR_COLORS.workshop },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ background: item.color }} />
                <span style={{ color: MONITOR_COLORS.textDim }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRIP DETAIL MODAL */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedTrip(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-xl" style={{ background: MONITOR_COLORS.card, border: `1px solid ${MONITOR_COLORS.border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: MONITOR_COLORS.accent }}>TRIP DETAILS</h3>
              <button onClick={() => setSelectedTrip(null)} className="text-slate-400 hover:text-white"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2 text-sm" style={{ color: '#fff' }}>
              <div><span style={{ color: MONITOR_COLORS.textDim }}>Plate:</span> {selectedTrip.vehicle?.plate_number || '—'}</div>
              <div><span style={{ color: MONITOR_COLORS.textDim }}>Driver:</span> {selectedTrip.driver?.name || '—'}</div>
              <div><span style={{ color: MONITOR_COLORS.textDim }}>Route:</span> {(selectedTrip.origin || selectedTrip.from_location || '—')} → {(selectedTrip.destination || selectedTrip.to_location || '—')}</div>
              <div><span style={{ color: MONITOR_COLORS.textDim }}>Departure:</span> {selectedTrip.departure_time || '—'}</div>
              <div><span style={{ color: MONITOR_COLORS.textDim }}>Arrival:</span> {selectedTrip.arrival_time || '—'}</div>
              <div><span style={{ color: MONITOR_COLORS.textDim }}>Distance:</span> {selectedTrip.distance_km || 0} km</div>
              <div><span style={{ color: MONITOR_COLORS.textDim }}>Cargo:</span> {selectedTrip.cargo_description || selectedTrip.cargo_type || '—'}</div>
              <div><span style={{ color: MONITOR_COLORS.textDim }}>Status:</span> {selectedTrip.status}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResponsiveBarChart({ data, currentHour }: { data: { hour: number; label: string; trips: number }[]; currentHour: number }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis dataKey="hour" tick={{ fill: MONITOR_COLORS.textDim, fontSize: 11 }} axisLine={{ stroke: MONITOR_COLORS.border }} tickLine={false} />
        <YAxis tick={{ fill: MONITOR_COLORS.textDim, fontSize: 11 }} axisLine={{ stroke: MONITOR_COLORS.border }} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: MONITOR_COLORS.card, border: `1px solid ${MONITOR_COLORS.border}`, color: '#fff', fontSize: '12px' }}
          labelStyle={{ color: MONITOR_COLORS.accent }}
          cursor={{ fill: `${MONITOR_COLORS.accent}11` }}
        />
        <Bar dataKey="trips" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.hour === currentHour ? MONITOR_COLORS.accent : `${MONITOR_COLORS.inProgress}aa`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
