import { useEffect, useState } from 'react';
import {
  Truck, Users, Wrench, Package, Route, Fuel, DollarSign,
  AlertTriangle, TrendingUp, Calendar, ShieldCheck, ChevronRight,
} from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { StatCard } from '@/components/StatCard';
import { Trip, Vehicle, Driver, SparePart, WorkRecord } from '@/types';
import { LoadingSpinner } from '@/components/Shared';
import { ContainersDueSoonAlert } from '@/components/ContainersDueSoonAlert';
import { MCLArea } from '@/lib/portals';

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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [workRecords, setWorkRecords] = useState<WorkRecord[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<{ id: string; label: string; type: string; days: number | null; isVehicle: boolean }[]>([]);

  useEffect(() => {
    async function load() {
      const currentSubAccount = subAccountProp ?? profile?.sub_account ?? getSubAccountFilter() ?? 'master';

      let tripsQuery = supabase.from('trips').select('*, driver:drivers(*), vehicle:vehicles(*)').order('trip_date', { ascending: false }).limit(50);
      let vehiclesQuery = supabase.from('vehicles').select('*');
      let driversQuery = supabase.from('drivers').select('*');
      let partsQuery = supabase.from('spare_parts').select('*');
      let workQuery = supabase.from('work_records').select('*').order('work_date', { ascending: false });
      let vcQuery = supabase.from('vehicle_compliance_items').select('id, vehicle_id, compliance_type, expiry_date, vehicle:vehicles(plate_number)').order('expiry_date', { ascending: true, nullsFirst: false });
      let dcQuery = supabase.from('driver_compliance_items').select('id, driver_id, compliance_type, expiry_date, driver:drivers(name)').order('expiry_date', { ascending: true, nullsFirst: false });

      if (currentSubAccount && currentSubAccount !== 'master' && currentSubAccount !== 'all') {
        tripsQuery = tripsQuery.eq('sub_account', currentSubAccount);
        vehiclesQuery = vehiclesQuery.eq('sub_account', currentSubAccount);
        driversQuery = driversQuery.eq('sub_account', currentSubAccount);
        partsQuery = partsQuery.eq('sub_account', currentSubAccount);
        workQuery = workQuery.eq('sub_account', currentSubAccount);
        vcQuery = vcQuery.eq('sub_account', currentSubAccount);
        dcQuery = dcQuery.eq('sub_account', currentSubAccount);
      }

      if (currentSubAccount === 'mcl' && mclArea) {
        tripsQuery = tripsQuery.eq('mcl_area_id', mclArea);
      }

      const [tripsRes, vehiclesRes, driversRes, partsRes, workRes, vcRes, dcRes] = await Promise.all([
        tripsQuery,
        vehiclesQuery,
        driversQuery,
        partsQuery,
        workQuery,
        vcQuery,
        dcQuery,
      ]);

      setTrips(tripsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
      setSpareParts(partsRes.data || []);
      setWorkRecords(workRes.data || []);

      const now = Date.now();
      const vAlerts = ((vcRes.data as any[]) || []).map((i: any) => ({
        id: i.id,
        label: i.vehicle?.plate_number || 'Unknown',
        type: i.compliance_type,
        days: i.expiry_date ? Math.ceil((new Date(i.expiry_date).getTime() - now) / 86400000) : null,
        isVehicle: true,
      }));
      const dAlerts = ((dcRes.data as any[]) || []).map((i: any) => ({
        id: i.id,
        label: i.driver?.name || 'Unknown',
        type: i.compliance_type,
        days: i.expiry_date ? Math.ceil((new Date(i.expiry_date).getTime() - now) / 86400000) : null,
        isVehicle: false,
      }));
      const all = [...vAlerts, ...dAlerts]
        .filter(a => a.days != null && a.days <= 30)
        .sort((a, b) => (a.days! - b.days!));
      setComplianceAlerts(all.slice(0, 5));

      setLoading(false);
    }
    load();
  }, [subAccountProp, profile?.sub_account, mclArea]);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />

  const portalColor = '#2563EB';

  const activeTrips = trips.filter(t => t.status === 'in_progress' || t.status === 'scheduled');
  const completedTrips = trips.filter(t => t.status === 'completed');
  const activeVehicles = vehicles.filter(v => v.status === 'active');
  const activeDrivers = drivers.filter(d => d.status === 'active');
  const lowStockParts = spareParts.filter(p => p.quantity_in_stock <= p.minimum_stock);
  const totalRevenue = completedTrips.reduce((sum, t) => sum + (t.freight_amount || 0), 0);
  const totalFuelCost = trips.reduce((sum, t) => sum + (t.fuel_cost || 0), 0);
  const totalWorkCost = workRecords.reduce((sum, w) => sum + (w.labor_cost || 0) + (w.parts_cost || 0), 0);
  const totalDistance = trips.reduce((sum, t) => sum + (t.distance_km || 0), 0);

  const recentTrips = trips.slice(0, 5);
  const recentWork = workRecords.slice(0, 5);

  const monthlyData = (() => {
    const months: Record<string, { revenue: number; fuel: number; trips: number }> = {};
    trips.forEach(t => {
      const m = t.trip_date?.slice(0, 7);
      if (!m) return;
      if (!months[m]) months[m] = { revenue: 0, fuel: 0, trips: 0 };
      months[m].revenue += t.freight_amount || 0;
      months[m].fuel += t.fuel_cost || 0;
      months[m].trips += 1;
    });
    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  })();

  const maxRevenue = Math.max(...monthlyData.map(([, v]) => v.revenue), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of your transport operations</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={`KES ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={<DollarSign className="h-6 w-6" />}
          color="emerald"
          trend={{ value: `${completedTrips.length} completed trips`, up: true }}
        />
        <StatCard
          label="Total Distance"
          value={`${totalDistance.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`}
          icon={<Route className="h-6 w-6" />}
          color="blue"
          trend={{ value: `${trips.length} total trips`, up: true }}
        />
        <StatCard
          label="Fuel Costs"
          value={`KES ${totalFuelCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={<Fuel className="h-6 w-6" />}
          color="amber"
        />
        <StatCard
          label="Maintenance Costs"
          value={`KES ${totalWorkCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={<Wrench className="h-6 w-6" />}
          color="rose"
        />
      </div>

      {/* Containers Due Soon Alert */}
      {onViewAllContainers && (
        <ContainersDueSoonAlert
          mclArea={mclArea ?? null}
          portalColor={portalColor}
          onViewAll={onViewAllContainers}
        />
      )}

      {/* Compliance Alerts */}
      {complianceAlerts.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-5 w-5 ${complianceAlerts.some(a => a.days! < 0) ? 'text-red-500' : 'text-amber-500'}`} />
              <h3 className={`text-base font-semibold ${complianceAlerts.some(a => a.days! < 0) ? 'text-red-700' : 'text-slate-900'}`}>
                Compliance Alerts
              </h3>
            </div>
            {onViewCompliance && (
              <button onClick={onViewCompliance} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="space-y-2">
            {complianceAlerts.map(a => {
              const isExpired = a.days! < 0;
              const isWeek = a.days! >= 0 && a.days! <= 7;
              const bgClass = isExpired ? 'bg-red-50 border-red-200' : isWeek ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200';
              const daysText = isExpired ? `${Math.abs(a.days!)} days ago` : `${a.days} days`;
              const daysColor = isExpired ? 'text-red-700' : isWeek ? 'text-orange-700' : 'text-amber-700';
              return (
                <div key={a.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${bgClass}`}>
                  <div className="flex items-center gap-3">
                    {a.isVehicle ? <Truck className="h-4 w-4 text-slate-500" /> : <Users className="h-4 w-4 text-slate-500" />}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.label}</p>
                      <p className="text-xs text-slate-500 capitalize">{a.type.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${daysColor}`}>{daysText}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Vehicles" value={String(activeVehicles.length)} icon={<Truck className="h-6 w-6" />} color="blue" />
        <StatCard label="Active Drivers" value={String(activeDrivers.length)} icon={<Users className="h-6 w-6" />} color="emerald" />
        <StatCard label="Active/Scheduled Trips" value={String(activeTrips.length)} icon={<Calendar className="h-6 w-6" />} color="amber" />
        <StatCard
          label="Low Stock Parts"
          value={String(lowStockParts.length)}
          icon={<AlertTriangle className="h-6 w-6" />}
          color={lowStockParts.length > 0 ? 'rose' : 'slate'}
        />
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Monthly Revenue & Fuel Costs</h3>
          {monthlyData.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No trip data yet</p>
          ) : (
            <div className="space-y-3">
              {monthlyData.map(([month, data]) => (
                <div key={month}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{month}</span>
                    <span className="text-slate-500">{data.trips} trips</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded transition-all duration-500"
                          style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-emerald-600 w-20 text-right">
                        KES {data.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-slate-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded transition-all duration-500"
                          style={{ width: `${(data.fuel / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-amber-600 w-20 text-right">
                        KES {data.fuel.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-semibold text-slate-900">Inventory Alerts</h3>
          </div>
          {lowStockParts.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">All parts are well stocked</p>
          ) : (
            <div className="space-y-2">
              {lowStockParts.slice(0, 6).map(part => (
                <div key={part.id} className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{part.part_name}</p>
                      {part.part_number && <p className="text-xs text-slate-500">{part.part_number}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="badge-danger">{part.quantity_in_stock} left</span>
                    <p className="text-xs text-slate-500 mt-0.5">Min: {part.minimum_stock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Trips */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Recent Trips</h3>
          {recentTrips.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No trips recorded yet</p>
          ) : (
            <div className="space-y-2">
              {recentTrips.map(trip => (
                <div key={trip.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Route className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {trip.origin || '—'} → {trip.destination || '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {trip.trip_date} · {trip.driver?.name || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {trip.freight_amount && (
                      <p className="text-sm font-semibold text-emerald-600">
                        KES {trip.freight_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    )}
                    <span className={`text-xs ${trip.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {trip.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Work Records */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Recent Maintenance</h3>
          {recentWork.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No work records yet</p>
          ) : (
            <div className="space-y-2">
              {recentWork.map(work => (
                <div key={work.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{work.description}</p>
                      <p className="text-xs text-slate-500">
                        {work.work_date} · {work.performed_by || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {((work.labor_cost || 0) + (work.parts_cost || 0)) > 0 && (
                      <p className="text-sm font-semibold text-slate-700">
                        KES {((work.labor_cost || 0) + (work.parts_cost || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    )}
                    <span className="text-xs text-emerald-600">{work.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
