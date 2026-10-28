import { useEffect, useState } from 'react';
import {
  Truck, Users, Wrench, Package, Route, Fuel, DollarSign,
  AlertTriangle, TrendingUp, Calendar, ShieldCheck, ChevronRight, Building2,
} from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { StatCard } from '@/components/StatCard';
import { Trip, Vehicle, Driver, SparePart, WorkRecord } from '@/types';
import { LoadingSpinner } from '@/components/Shared';
import { ContainersDueSoonAlert } from '@/components/ContainersDueSoonAlert';
import { MCLArea, SubAccount, slugFromPath } from '@/lib/portals';

const SUB_ACCOUNTS = ['mcl', 'tarmal', 'csl', 'mushroom'] as const;

interface SubAccountSummary {
  subAccount: string;
  totalRevenue: number;
  totalDistance: number;
  fuelCost: number;
  activeVehicles: number;
  activeDrivers: number;
  totalTrips: number;
  activeContainers: number;
}

export function Dashboard({ 
  subAccount: subAccountProp,
  mclArea, 
  onViewAllContainers, 
  onViewCompliance 
}: { 
  subAccount?: string;
  mclArea?: MCLArea | null; 
  onViewAllContainers?: () => void; 
  onViewCompliance?: () => void 
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Determine current sub-account from props, URL path slug, profile, or fallback
  const pathSlug = slugFromPath(window.location.pathname);
  let currentSubAccount = subAccountProp || pathSlug || profile?.sub_account || getSubAccountFilter() || 'mcl';
  if (currentSubAccount === 'admin') currentSubAccount = 'mcl';

  const isMasterView = currentSubAccount === 'master' || currentSubAccount === 'all';

  // Master Summaries State
  const [summaries, setSummaries] = useState<Record<string, SubAccountSummary>>({});

  // Single Sub-Account Dashboard State
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [workRecords, setWorkRecords] = useState<WorkRecord[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<{ id: string; label: string; type: string; days: number | null; isVehicle: boolean }[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      if (isMasterView) {
        // Load Master Summaries across all sub-accounts
        const results: Record<string, SubAccountSummary> = {};
        for (const sa of SUB_ACCOUNTS) {
          const [tripsRes, vehiclesRes, driversRes, containersRes] = await Promise.all([
            supabase.from('sub_account_trips').select('tons, total_fuel_added, status').eq('sub_account', sa),
            supabase.from('vehicles').select('id', { count: 'exact' }).eq('sub_account', sa),
            supabase.from('drivers').select('id', { count: 'exact' }).eq('sub_account', sa),
            supabase.from('sub_account_containers').select('id', { count: 'exact' }).eq('sub_account', sa),
          ]);

          const tripList = tripsRes.data || [];

          results[sa] = {
            subAccount: sa.toUpperCase(),
            totalRevenue: tripList.reduce((sum, t) => sum + (Number(t.tons) || 0) * 420, 0), // estimated rate
            totalDistance: tripList.length * 50,
            fuelCost: tripList.reduce((sum, t) => sum + (Number(t.total_fuel_added) || 0) * 214.5, 0),
            activeVehicles: vehiclesRes.count || 0,
            activeDrivers: driversRes.count || 0,
            totalTrips: tripList.length,
            activeContainers: containersRes.count || 0,
          };
        }
        setSummaries(results);
      } else {
        // Load Specific Sub-Account Operational Data (supports fallback to master or current subaccount)
        let tripsQuery = supabase.from('sub_account_trips').select('*').or(`sub_account.eq.${currentSubAccount},sub_account.eq.master`).order('trip_date', { ascending: false }).limit(50);
        let vehiclesQuery = supabase.from('vehicles').select('*').or(`sub_account.eq.${currentSubAccount},sub_account.eq.master`);
        let driversQuery = supabase.from('drivers').select('*').or(`sub_account.eq.${currentSubAccount},sub_account.eq.master`);
        let partsQuery = supabase.from('spare_parts').select('*').or(`sub_account.eq.${currentSubAccount},sub_account.eq.master`);
        let workQuery = supabase.from('work_records').select('*').or(`sub_account.eq.${currentSubAccount},sub_account.eq.master`).order('work_date', { ascending: false });
        let vcQuery = supabase.from('vehicle_compliance_items').select('id, vehicle_id, compliance_type, expiry_date, vehicle:vehicles(plate_number)').or(`sub_account.eq.${currentSubAccount},sub_account.eq.master`).order('expiry_date', { ascending: true, nullsFirst: false });
        let dcQuery = supabase.from('driver_compliance_items').select('id, driver_id, compliance_type, expiry_date, driver:drivers(name)').or(`sub_account.eq.${currentSubAccount},sub_account.eq.master`).order('expiry_date', { ascending: true, nullsFirst: false });

        if (currentSubAccount === 'mcl' && mclArea) {
          tripsQuery = tripsQuery.eq('mcl_area_id', mclArea);
        }

        const [tripsRes, vehiclesRes, driversRes, partsRes, workRes, vcRes, dcRes] = await Promise.all([
          tripsQuery, vehiclesQuery, driversQuery, partsQuery, workQuery, vcQuery, dcQuery,
        ]);

        setTrips(tripsRes.data || []);
        setVehicles(vehiclesRes.data || []);
        setDrivers(driversRes.data || []);
        setSpareParts(partsRes.data || []);
        setWorkRecords(workRes.data || []);

        const now = Date.now();
        const vAlerts = ((vcRes.data as any[]) || []).map((i: any) => ({
          id: i.id, label: i.vehicle?.plate_number || 'Unknown', type: i.compliance_type,
          days: i.expiry_date ? Math.ceil((new Date(i.expiry_date).getTime() - now) / 86400000) : null, isVehicle: true,
        }));
        const dAlerts = ((dcRes.data as any[]) || []).map((i: any) => ({
          id: i.id, label: i.driver?.name || 'Unknown', type: i.compliance_type,
          days: i.expiry_date ? Math.ceil((new Date(i.expiry_date).getTime() - now) / 86400000) : null, isVehicle: false,
        }));
        const all = [...vAlerts, ...dAlerts].filter(a => a.days != null && a.days <= 30).sort((a, b) => (a.days! - b.days!));
        setComplianceAlerts(all.slice(0, 5));
      }

      setLoading(false);
    }

    loadData();
  }, [currentSubAccount, isMasterView, mclArea]);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  // Render Master Summary View
  if (isMasterView) {
    const totalSystemRevenue = Object.values(summaries).reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalSystemDistance = Object.values(summaries).reduce((sum, s) => sum + s.totalDistance, 0);
    const totalSystemFuel = Object.values(summaries).reduce((sum, s) => sum + s.fuelCost, 0);
    const totalSystemFleet = Object.values(summaries).reduce((sum, s) => sum + s.activeVehicles, 0);

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-700 text-white shadow-sm">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Master Fleet Summary</h1>
            <p className="text-sm text-slate-500">Overview across all registered sub-account portals</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Group Revenue" value={`KES ${totalSystemRevenue.toLocaleString()}`} icon={<DollarSign className="h-6 w-6" />} color="emerald" />
          <StatCard label="Total Distance Covered" value={`${totalSystemDistance.toLocaleString()} km`} icon={<Route className="h-6 w-6" />} color="blue" />
          <StatCard label="Total Fuel Spend" value={`KES ${totalSystemFuel.toLocaleString()}`} icon={<Fuel className="h-6 w-6" />} color="amber" />
          <StatCard label="Total Active Fleet" value={`${totalSystemFleet} Trucks`} icon={<Truck className="h-6 w-6" />} color="rose" />
        </div>

        <h2 className="text-base font-bold text-slate-800 pt-2">Sub-Account Breakdowns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {SUB_ACCOUNTS.map(sa => {
            const s = summaries[sa];
            if (!s) return null;
            return (
              <div key={sa} className="card p-5 border border-slate-200 space-y-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-red-700" />
                    <h3 className="font-bold text-lg text-slate-900">{s.subAccount} Portal</h3>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                    {s.totalTrips} Total Trips
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Revenue</p><p className="text-sm font-bold text-emerald-600">KES {s.totalRevenue.toLocaleString()}</p></div>
                  <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Fuel Cost</p><p className="text-sm font-bold text-amber-600">KES {s.fuelCost.toLocaleString()}</p></div>
                  <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Distance</p><p className="text-sm font-bold text-blue-600">{s.totalDistance.toLocaleString()} km</p></div>
                  <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Active Trucks</p><p className="text-sm font-bold text-slate-800">{s.activeVehicles}</p></div>
                  <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Active Drivers</p><p className="text-sm font-bold text-slate-800">{s.activeDrivers}</p></div>
                  <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Active Containers</p><p className="text-sm font-bold text-slate-800">{s.activeContainers}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render Specific Sub-Account Operational Dashboard (MCL, Tarmal, CSL, Mushroom)
  const activeTrips = trips.filter(t => t.status === 'in_progress' || t.status === 'scheduled');
  const completedTrips = trips.filter(t => t.status === 'completed' || !t.status);
  const activeVehicles = vehicles;
  const activeDrivers = drivers;
  const lowStockParts = spareParts.filter(p => (p.quantity_in_stock || 0) <= (p.minimum_stock || 5));
  const totalRevenue = completedTrips.reduce((sum, t) => sum + ((Number(t.tons) || 0) * 420 || t.freight_amount || 0), 0);
  const totalFuelCost = trips.reduce((sum, t) => sum + ((Number(t.total_fuel_added) || 0) * 214.5 || t.fuel_cost || 0), 0);
  const totalWorkCost = workRecords.reduce((sum, w) => sum + (w.labor_cost || 0) + (w.parts_cost || 0), 0);
  const totalDistance = trips.reduce((sum, t) => sum + (t.distance_km || 50), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-950 uppercase">{currentSubAccount} Portal Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of transport operations for {currentSubAccount.toUpperCase()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={`KES ${totalRevenue.toLocaleString()}`} icon={<DollarSign className="h-6 w-6" />} color="emerald" />
        <StatCard label="Total Distance" value={`${totalDistance.toLocaleString()} km`} icon={<Route className="h-6 w-6" />} color="blue" />
        <StatCard label="Fuel Costs" value={`KES ${totalFuelCost.toLocaleString()}`} icon={<Fuel className="h-6 w-6" />} color="amber" />
        <StatCard label="Maintenance Costs" value={`KES ${totalWorkCost.toLocaleString()}`} icon={<Wrench className="h-6 w-6" />} color="rose" />
      </div>

      {onViewAllContainers && (
        <ContainersDueSoonAlert mclArea={mclArea ?? null} portalColor="#2563EB" onViewAll={onViewAllContainers} />
      )}

      {complianceAlerts.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-semibold text-slate-900">Compliance Alerts</h3>
            </div>
            {onViewCompliance && (
              <button onClick={onViewCompliance} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="space-y-2">
            {complianceAlerts.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  {a.isVehicle ? <Truck className="h-4 w-4 text-slate-500" /> : <Users className="h-4 w-4 text-slate-500" />}
                  <div><p className="text-sm font-medium text-slate-800">{a.label}</p><p className="text-xs text-slate-500 capitalize">{a.type.replace(/_/g, ' ')}</p></div>
                </div>
                <span className="text-xs font-semibold text-amber-700">{a.days} days</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Vehicles" value={String(activeVehicles.length)} icon={<Truck className="h-6 w-6" />} color="blue" />
        <StatCard label="Active Drivers" value={String(activeDrivers.length)} icon={<Users className="h-6 w-6" />} color="emerald" />
        <StatCard label="Active/Scheduled Trips" value={String(activeTrips.length || trips.length)} icon={<Calendar className="h-6 w-6" />} color="amber" />
        <StatCard label="Low Stock Parts" value={String(lowStockParts.length)} icon={<AlertTriangle className="h-6 w-6" />} color={lowStockParts.length > 0 ? 'rose' : 'slate'} />
      </div>
    </div>
  );
}
