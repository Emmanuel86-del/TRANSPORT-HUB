import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { SubAccount, MCLArea } from '@/lib/portals';
import { ReportData, ReportFilters } from '@/lib/report-utils';

export function useReportData(filters: ReportFilters, isMaster: boolean, masterSubAccount?: SubAccount) {
  const { profile } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const subAccount = (masterSubAccount ?? profile?.sub_account ?? getSubAccountFilter() ?? 'master') as SubAccount;
  const isMCL = subAccount === 'mcl';

  const loadData = useCallback(async () => {
    setLoading(true);

    const from = filters.fromDate;
    const to = filters.toDate;

    let tripQ = supabase
      .from('sub_account_trips')
      .select('*, vehicle:vehicles(plate_number, make, model), driver:drivers(name)')
      .gte('trip_date', from)
      .lte('trip_date', to)
      .order('trip_date', { ascending: false });

    let fuelQ = supabase
      .from('sub_account_fuel')
      .select('*, vehicle:vehicles(plate_number), driver:drivers(name)')
      .gte('refuel_date', from)
      .lte('refuel_date', to)
      .order('refuel_date', { ascending: false });

    let tallyQ = supabase
      .from('sub_account_tallies')
      .select('*, vehicle:vehicles(plate_number)')
      .gte('tally_date', from)
      .lte('tally_date', to)
      .order('tally_date', { ascending: false });

    let partsQ = supabase
      .from('spare_parts_v2')
      .select('*, vehicle:vehicles(plate_number)')
      .order('created_at', { ascending: false });

    let contQ = supabase
      .from('sub_account_containers')
      .select('*, vehicle:vehicles(plate_number)')
      .order('created_at', { ascending: false });

    let vcQ = supabase
      .from('vehicle_compliance')
      .select('*, vehicle:vehicles(plate_number)')
      .order('updated_at', { ascending: false });

    let dcQ = supabase
      .from('driver_compliance')
      .select('*, driver:drivers(name)')
      .order('updated_at', { ascending: false });

    const vehQ = supabase.from('vehicles').select('id, plate_number, make, model').order('plate_number');
    const drvQ = supabase.from('drivers').select('id, name').order('name');

    if (filters.vehicleId) {
      tripQ = tripQ.eq('vehicle_id', filters.vehicleId);
      fuelQ = fuelQ.eq('vehicle_id', filters.vehicleId);
      tallyQ = tallyQ.eq('vehicle_id', filters.vehicleId);
    }

    if (isMCL && filters.mclArea) {
      tripQ = tripQ.eq('mcl_area_id', filters.mclArea);
      fuelQ = fuelQ.eq('mcl_area_id', filters.mclArea);
      tallyQ = tallyQ.eq('mcl_area_id', filters.mclArea);
    }

    const [trips, fuel, tallies, parts, containers, vc, dc, vehicles, drivers] = await Promise.all([
      tripQ, fuelQ, tallyQ, partsQ, contQ, vcQ, dcQ, vehQ, drvQ,
    ]);

    setData({
      trips: trips.data || [],
      fuel: fuel.data || [],
      tallies: tallies.data || [],
      spareParts: parts.data || [],
      containers: containers.data || [],
      vehicleCompliance: vc.data || [],
      driverCompliance: dc.data || [],
      vehicles: vehicles.data || [],
      drivers: drivers.data || [],
    });
    setLoading(false);
  }, [filters.fromDate, filters.toDate, filters.vehicleId, filters.mclArea, isMCL]);

  useEffect(() => { loadData(); }, [loadData]);

  return { data, loading, subAccount };
}
