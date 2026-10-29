import { useState, useEffect, ReactNode } from 'react';
import * as Icons from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/lib/auth';
import { portalLabel } from '@/lib/portals';
import { LiveMonitor } from './LiveMonitor';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/Shared';

type IconName = keyof typeof Icons;

export function PlaceholderPage({
  title,
  subtitle,
  iconName = 'Construction',
  iconColor,
}: {
  title: string;
  subtitle: string;
  iconName?: string;
  iconColor?: string;
}) {
  const { profile } = useAuth();
  const Icon = (Icons[iconName as IconName] || Icons.Construction) as Icons.LucideIcon;
  const sa = profile?.sub_account ?? 'master';

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={<Icon className="h-6 w-6" />}
        iconColor={iconColor}
      />
      <div className="card flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-700 mb-1">{title} — Coming Soon</h3>
        <p className="max-w-sm text-sm text-slate-500">
          This module is being built for {portalLabel(sa)}. Data and forms will appear here once available.
        </p>
      </div>
    </div>
  );
}

export function FuelPage({ color }: { color: string }) {
  return <PlaceholderPage title="Fuel Management" subtitle="Track fuel consumption and costs" iconName="Fuel" iconColor={color} />;
}

export function TalliesPage({ color }: { color: string }) {
  return <PlaceholderPage title="Tallies" subtitle="Daily tally records and summaries" iconName="Calculator" iconColor={color} />;
}

interface SubAccountMetrics {
  totalTrips: number;
  revenue: number;
  fuelCost: number;
  distance: number;
  activeTrucks: number;
  activeDrivers: number;
  activeContainers: number;
}

export function OverviewPage({ color }: { color: string }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, SubAccountMetrics>>({
    mcl: { totalTrips: 0, revenue: 0, fuelCost: 0, distance: 0, activeTrucks: 0, activeDrivers: 0, activeContainers: 0 },
    tarmal: { totalTrips: 0, revenue: 0, fuelCost: 0, distance: 0, activeTrucks: 0, activeDrivers: 0, activeContainers: 0 },
    csl: { totalTrips: 0, revenue: 0, fuelCost: 0, distance: 0, activeTrucks: 0, activeDrivers: 0, activeContainers: 0 },
    pn_mashru: { totalTrips: 0, revenue: 0, fuelCost: 0, distance: 0, activeTrucks: 0, activeDrivers: 0, activeContainers: 0 },
  });

  useEffect(() => {
    async function loadMasterOverview() {
      try {
        const [tripsRes, vehiclesRes, driversRes, containersRes, fuelRes] = await Promise.all([
          supabase.from('trips').select('*'),
          supabase.from('vehicles').select('*'),
          supabase.from('drivers').select('*'),
          supabase.from('containers').select('*'),
          supabase.from('fuel').select('*').then(res => res.error ? supabase.from('fuel_logs').select('*') : res),
        ]);

        const trips = tripsRes.data || [];
        const vehicles = vehiclesRes.data || [];
        const drivers = driversRes.data || [];
        const containers = containersRes.data || [];
        const fuelLogs = fuelRes.data || [];

        const subAccounts = ['mcl', 'tarmal', 'csl', 'mushroom'];
        const newMetrics: Record<string, SubAccountMetrics> = {};

        subAccounts.forEach(sa => {
          const saTrips = trips.filter((t: any) => (t.sub_account || '').toLowerCase() === sa);
          const saVehicles = vehicles.filter((v: any) => (v.sub_account || '').toLowerCase() === sa);
          const saDrivers = drivers.filter((d: any) => (d.sub_account || '').toLowerCase() === sa);
          const saContainers = containers.filter((c: any) => (c.sub_account || '').toLowerCase() === sa);
          const saFuel = fuelLogs.filter((f: any) => (f.sub_account || '').toLowerCase() === sa);

          const revenue = saTrips.reduce((sum: number, t: any) => sum + Number(t.revenue || t.fare || t.amount || 0), 0);
          const distance = saTrips.reduce((sum: number, t: any) => sum + Number(t.distance || t.km || 0), 0);
          const fuelCost = saFuel.reduce((sum: number, f: any) => sum + Number(f.cost || f.total_cost || f.amount || 0), 0);

          newMetrics[sa] = {
            totalTrips: saTrips.length,
            revenue,
            fuelCost,
            distance,
            activeTrucks: saVehicles.length,
            activeDrivers: saDrivers.length,
            activeContainers: saContainers.length,
          };
        });

        setMetrics(newMetrics);
      } catch (err) {
        console.error('[OverviewPage] Error loading master metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    // Initial load
    loadMasterOverview();

    // Supabase Real-Time Subscriptions for instant updates
    const channel = supabase
      .channel('master-fleet-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadMasterOverview())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => loadMasterOverview())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => loadMasterOverview())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, () => loadMasterOverview())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fuel' }, () => loadMasterOverview())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fuel_logs' }, () => loadMasterOverview())
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const portals = [
    { key: 'mcl', name: 'MCL Portal', color: 'text-red-600' },
    { key: 'tarmal', name: 'Tarmal Portal', color: 'text-red-600' },
    { key: 'csl', name: 'CSL Portal', color: 'text-red-600' },
    { key: 'mushroom', name: 'Mushroom Portal', color: 'text-red-600' },
  ];

  const totalGroupRevenue = Object.values(metrics).reduce((sum, m) => sum + m.revenue, 0);
  const totalDistanceCovered = Object.values(metrics).reduce((sum, m) => sum + m.distance, 0);
  const totalFuelSpend = Object.values(metrics).reduce((sum, m) => sum + m.fuelCost, 0);
  const totalActiveFleet = Object.values(metrics).reduce((sum, m) => sum + m.activeTrucks, 0);

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader title="Master Fleet Summary" subtitle="Overview across all registered sub-account portals" icon={<Icons.LayoutDashboard className="h-6 w-6" />} iconColor={color} />
        <LoadingSpinner message="Aggregating master fleet data..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Master Fleet Summary"
        subtitle="Overview across all registered sub-account portals"
        icon={<Icons.LayoutDashboard className="h-6 w-6" />}
        iconColor={color}
      />

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Group Revenue</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Icons.DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">KES {totalGroupRevenue.toLocaleString()}</p>
        </div>

        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Distance Covered</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icons.Route className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalDistanceCovered.toLocaleString()} km</p>
        </div>

        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Fuel Spend</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Icons.Fuel className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">KES {totalFuelSpend.toLocaleString()}</p>
        </div>

        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Active Fleet</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Icons.Truck className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalActiveFleet} Trucks</p>
        </div>
      </div>

      {/* Sub-Account Breakdowns */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-800">Sub-Account Breakdowns</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {portals.map(portal => {
            const data = metrics[portal.key] || { totalTrips: 0, revenue: 0, fuelCost: 0, distance: 0, activeTrucks: 0, activeDrivers: 0, activeContainers: 0 };
            return (
              <div key={portal.key} className="card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <Icons.Building2 className="h-4 w-4" />
                    </div>
                    <h4 className="font-bold text-slate-800">{portal.name}</h4>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {data.totalTrips} Total Trips
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-50/70 p-3 rounded-xl">
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 uppercase">Revenue</p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">KES {data.revenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 uppercase">Fuel Cost</p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">KES {data.fuelCost.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 uppercase">Distance</p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">{data.distance.toLocaleString()} km</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="card p-3 bg-white border border-slate-100">
                    <p className="text-[11px] text-slate-400">Active Trucks</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{data.activeTrucks}</p>
                  </div>
                  <div className="card p-3 bg-white border border-slate-100">
                    <p className="text-[11px] text-slate-400">Active Drivers</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{data.activeDrivers}</p>
                  </div>
                  <div className="card p-3 bg-white border border-slate-100">
                    <p className="text-[11px] text-slate-400">Active Containers</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{data.activeContainers}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CompliancePage({ color }: { color: string }) {
  return <PlaceholderPage title="Compliance" subtitle="Fleet and driver compliance across all sub-accounts" iconName="ShieldCheck" iconColor={color} />;
}

export function SubAccountViewPage({ color, name }: { color: string; name: string }) {
  const lowerName = name.toLowerCase();
  let subAccountKey = 'all';
  if (lowerName.includes('mcl')) subAccountKey = 'mcl';
  else if (lowerName.includes('tarmal')) subAccountKey = 'tarmal';
  else if (lowerName.includes('csl')) subAccountKey = 'csl';
  else if (lowerName.includes('mushroom')) subAccountKey = 'mushroom';

  return <LiveMonitor color={color} subAccountFilter={subAccountKey} />;
}
