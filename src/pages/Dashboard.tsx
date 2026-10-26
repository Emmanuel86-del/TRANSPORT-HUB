import { useEffect, useState } from 'react';
import {
  Truck, Users, Route, Fuel, DollarSign, Package,
  TrendingUp, Building2, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/StatCard';
import { LoadingSpinner } from '@/components/Shared';

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

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<string, SubAccountSummary>>({});

  useEffect(() => {
    async function loadMasterSummary() {
      setLoading(true);
      const results: Record<string, SubAccountSummary> = {};

      for (const sa of SUB_ACCOUNTS) {
        const [tripsRes, vehiclesRes, driversRes, containersRes] = await Promise.all([
          supabase.from('trips').select('freight_amount, fuel_cost, distance_km, status').eq('sub_account', sa),
          supabase.from('vehicles').select('id', { count: 'exact' }).eq('sub_account', sa).eq('status', 'active'),
          supabase.from('drivers').select('id', { count: 'exact' }).eq('sub_account', sa).eq('status', 'active'),
          supabase.from('sub_account_containers').select('id', { count: 'exact' }).eq('sub_account', sa).eq('status', 'active'),
        ]);

        const trips = tripsRes.data || [];
        const completedTrips = trips.filter(t => t.status === 'completed');

        results[sa] = {
          subAccount: sa.toUpperCase(),
          totalRevenue: completedTrips.reduce((sum, t) => sum + (t.freight_amount || 0), 0),
          totalDistance: trips.reduce((sum, t) => sum + (t.distance_km || 0), 0),
          fuelCost: trips.reduce((sum, t) => sum + (t.fuel_cost || 0), 0),
          activeVehicles: vehiclesRes.count || 0,
          activeDrivers: driversRes.count || 0,
          totalTrips: trips.length,
          activeContainers: containersRes.count || 0,
        };
      }

      setSummaries(results);
      setLoading(false);
    }

    loadMasterSummary();
  }, []);

  if (loading) return <LoadingSpinner message="Loading sub-account summaries..." />;

  // Aggregated Master Totals
  const totalSystemRevenue = Object.values(summaries).reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalSystemDistance = Object.values(summaries).reduce((sum, s) => sum + s.totalDistance, 0);
  const totalSystemFuel = Object.values(summaries).reduce((sum, s) => sum + s.fuelCost, 0);
  const totalSystemFleet = Object.values(summaries).reduce((sum, s) => sum + s.activeVehicles, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-700 text-white shadow-sm">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Master Fleet Summary</h1>
          <p className="text-sm text-slate-500">Overview across all registered sub-account portals</p>
        </div>
      </div>

      {/* High-Level System Totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Group Revenue"
          value={`KES ${totalSystemRevenue.toLocaleString()}`}
          icon={<DollarSign className="h-6 w-6" />}
          color="emerald"
        />
        <StatCard
          label="Total Distance Covered"
          value={`${totalSystemDistance.toLocaleString()} km`}
          icon={<Route className="h-6 w-6" />}
          color="blue"
        />
        <StatCard
          label="Total Fuel Spend"
          value={`KES ${totalSystemFuel.toLocaleString()}`}
          icon={<Fuel className="h-6 w-6" />}
          color="amber"
        />
        <StatCard
          label="Total Active Fleet"
          value={`${totalSystemFleet} Trucks`}
          icon={<Truck className="h-6 w-6" />}
          color="rose"
        />
      </div>

      {/* Sub-Account Breakdown Cards */}
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
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="text-sm font-bold text-emerald-600">KES {s.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Fuel Cost</p>
                  <p className="text-sm font-bold text-amber-600">KES {s.fuelCost.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Distance</p>
                  <p className="text-sm font-bold text-blue-600">{s.totalDistance.toLocaleString()} km</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Active Trucks</p>
                  <p className="text-sm font-bold text-slate-800">{s.activeVehicles}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Active Drivers</p>
                  <p className="text-sm font-bold text-slate-800">{s.activeDrivers}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Active Containers</p>
                  <p className="text-sm font-bold text-slate-800">{s.activeContainers}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
