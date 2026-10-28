import { useEffect, useState, useCallback, useMemo } from 'react';
import { Route as RouteIcon, Plus, Edit, Download, Upload } from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount, MCLArea } from '@/lib/portals';
import { BulkImportModal } from '@/components/BulkImportModal';

export function SubAccountTrips({ mclArea, portalColor }: { mclArea: MCLArea | null; portalColor: string }) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const subAccount = (profile?.sub_account ?? getSubAccountFilter() ?? 'master') as SubAccount;
  const isMCL = subAccount === 'mcl';

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // MCL Multi-Trip Daily Form Schema
  const emptyForm = {
    trip_date: new Date().toISOString().split('T')[0],
    vehicle_id: '',
    driver_id: '',
    // Multi-Trip Daily slots (Trip 1 - Trip 13)
    trip_1: 0,
    trip_2: 0,
    trip_3: 0,
    trip_4: 0,
    trip_5: 0,
    trip_6: 0,
    trip_7: 0,
    trip_8: 0,
    trip_9: 0,
    trip_10: 0,
    trip_11: 0,
    trip_12: 0,
    trip_13: 0,
    // Daily & Cumulative Tonnage/Trip Metrics
    tons: 0,
    cummulative_tons: 0,
    trips_count: 0,
    cummulative_trips: 0,
    // Fuel Log Metrics
    fuel_1: 0,
    fuel_2: 0,
    fuel_3: 0,
    total_fuel_added: 0,
    expected_fuel_bal: 0,
    actual_fuel_bal: 0,
    status: 'completed',
    notes: '',
  };

  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tripRes, vehRes, drvRes] = await Promise.all([
      supabase.from('sub_account_trips')
        .select('*, vehicle:vehicles(plate_number, make, model), driver:drivers(name)')
        .order('trip_date', { ascending: false }),
      supabase.from('vehicles').select('id, plate_number, make, model').order('plate_number'),
      supabase.from('drivers').select('id, name').order('name'),
    ]);
    setTrips(tripRes.data || []);
    setVehicles(vehRes.data || []);
    setDrivers(drvRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const visibleTrips = useMemo(() => {
    if (isMCL && mclArea) return trips.filter(t => t.mcl_area_id === mclArea);
    return trips;
  }, [trips, isMCL, mclArea]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (t: any) => {
    const { id, vehicle, driver, created_at, sub_account, mcl_area_id, ...rest } = t;
    setForm({ ...emptyForm, ...rest });
    setEditId(id);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload: any = { ...form, sub_account: subAccount };
    if (isMCL && mclArea) payload.mcl_area_id = mclArea;

    if (editId) {
      const { error } = await supabase.from('sub_account_trips').update(payload).eq('id', editId);
      if (error) showToast('Failed to save: ' + error.message, 'error');
      else showToast('MCL Log updated successfully', 'success');
    } else {
      const { error } = await supabase.from('sub_account_trips').insert([payload]);
      if (error) showToast('Failed to create: ' + error.message, 'error');
      else showToast('MCL Log created successfully', 'success');
    }
    setSaving(false);
    setModalOpen(false);
    loadData();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title={isMCL ? 'MCL Operational Daily Logs' : 'Trips'}
          subtitle={isMCL ? 'Shale & Limestone multi-trip logs, cumulative tonnage, and fuel tracking' : 'Trip records and dispatch'}
          icon={<RouteIcon className="h-6 w-6" />}
          iconColor={portalColor}
          onAdd={openAdd}
          addLabel="Add Daily Log"
        />
        <button
          onClick={() => setIsBulkOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
        >
          <Upload className="h-4 w-4 text-slate-500" />
          Bulk Excel Import
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading MCL daily trip logs..." />
      ) : visibleTrips.length === 0 ? (
        <div className="card">
          <EmptyState icon={<RouteIcon className="h-8 w-8" />} title="No daily trip logs found" message="Upload your monthly Excel sheet or add a daily log manually." />
        </div>
      ) : (
        <div className="card table-wrapper overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Date</th>
                <th>Truck</th>
                <th>Driver</th>
                {isMCL && <>
                  <th>Trips (1-13)</th>
                  <th>Daily Tons</th>
                  <th>Cum. Tons</th>
                  <th>Daily Trips</th>
                  <th>Cum. Trips</th>
                  <th>Total Fuel (L)</th>
                </>}
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleTrips.map(t => {
                // Calculate quick total trips logged across slots 1 to 13
                const tripSlotsCount = [
                  t.trip_1, t.trip_2, t.trip_3, t.trip_4, t.trip_5, t.trip_6,
                  t.trip_7, t.trip_8, t.trip_9, t.trip_10, t.trip_11, t.trip_12, t.trip_13
                ].filter(val => val > 0).length;

                return (
                  <tr key={t.id}>
                    <td className="font-medium text-slate-700">{t.trip_date}</td>
                    <td className="font-bold text-slate-800">{t.vehicle?.plate_number || '—'}</td>
                    <td className="text-slate-600">{t.driver?.name || '—'}</td>
                    {isMCL && <>
                      <td className="text-slate-600 font-mono">{t.trips_count || tripSlotsCount || 0} Slots</td>
                      <td className="font-semibold text-emerald-700">{t.tons || 0} T</td>
                      <td className="text-slate-600">{t.cummulative_tons || 0} T</td>
                      <td className="font-semibold text-blue-700">{t.trips_count || 0}</td>
                      <td className="text-slate-600">{t.cummulative_trips || 0}</td>
                      <td className="text-amber-700 font-medium">{t.total_fuel_added || t.fuel_actual || 0} L</td>
                    </>}
                    <td>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-700">
                        {t.status || 'completed'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Multi-Trip Log Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit MCL Operational Log' : 'Add MCL Operational Log'} size="xl">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto p-1">
          {/* Section 1: Basic Information */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Log Date *</label>
              <input type="date" className="input" value={form.trip_date} onChange={e => setForm({ ...form, trip_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Truck / Lorry *</label>
              <select className="input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}>
                <option value="">Select Truck</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Driver</label>
              <select className="input" value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })}>
                <option value="">Select Driver</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Section 2: Individual Trip Slots (Trip 1 - Trip 13) */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Daily Trip Runs (Trip 1 to 13)</h4>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(num => {
                const key = `trip_${num}` as keyof typeof form;
                return (
                  <div key={num}>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Trip {num}</label>
                    <input
                      type="number"
                      className="input text-xs text-center py-1 px-1"
                      value={form[key] as number}
                      onChange={e => setForm({ ...form, [key]: Number(e.target.value) })}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Daily & Cumulative Metrics */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Daily Tonnage & Trips Summary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <label className="label">Daily Tons</label>
                <input type="number" className="input" value={form.tons} onChange={e => setForm({ ...form, tons: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Cumulative Tons</label>
                <input type="number" className="input" value={form.cummulative_tons} onChange={e => setForm({ ...form, cummulative_tons: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Daily Trips</label>
                <input type="number" className="input" value={form.trips_count} onChange={e => setForm({ ...form, trips_count: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Cumulative Trips</label>
                <input type="number" className="input" value={form.cummulative_trips} onChange={e => setForm({ ...form, cummulative_trips: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          {/* Section 4: Daily Fuel Logs */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fuel Reconciliation (Liters)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <label className="label">Fuel Added (1)</label>
                <input type="number" className="input" value={form.fuel_1} onChange={e => setForm({ ...form, fuel_1: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Total Fuel Added</label>
                <input type="number" className="input" value={form.total_fuel_added} onChange={e => setForm({ ...form, total_fuel_added: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Expected Fuel Bal</label>
                <input type="number" className="input" value={form.expected_fuel_bal} onChange={e => setForm({ ...form, expected_fuel_bal: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Actual Fuel Bal</label>
                <input type="number" className="input" value={form.actual_fuel_bal} onChange={e => setForm({ ...form, actual_fuel_bal: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t pt-3">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary" style={{ background: portalColor }}>
            {saving ? 'Saving...' : 'Save Log Entry'}
          </button>
        </div>
      </Modal>

      <BulkImportModal
        open={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        tableName="sub_account_trips"
        portalColor={portalColor}
        subAccount={subAccount}
        sampleColumns={[
          'DATE', 'Trip 1', 'Trip 2', 'Trip 3', 'Trip 4', 'Trip 5', 'Trip 6', 
          'Trip 7', 'Trip 8', 'Trip 9', 'Trip 10', 'Trip 11', 'Trip 12', 'Trip 13', 
          'TONS', 'CUMMULATIVE TONS', 'TRIPS', 'CUMMULATIVE TRIPS', 'TOTAL Fuel Added (L)'
        ]}
        onSuccess={loadData}
      />
    </div>
  );
}
