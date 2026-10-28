import { useEffect, useState, useCallback, useMemo } from 'react';
import { Route as RouteIcon, Edit, Upload } from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount, MCLArea } from '@/lib/portals';
import { BulkImportModal } from '@/components/BulkImportModal';

// Material source abbreviations used in the MCL sheets
const SOURCES: Record<string, string> = {
  M: 'MCL Mines',
  G: 'Gas',
  N: 'Ngamani',
  S: 'Minor St/Pile',
  T: 'TEZZO (Ngamani)',
};

const TRIP_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// Read "Trip1=T; Trip2=N" from notes -> { 1: 'T', 2: 'N' }
function parseSources(notes?: string | null): Record<number, string> {
  const out: Record<number, string> = {};
  if (!notes) return out;
  const re = /Trip(\d+)=([A-Za-z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(notes)) !== null) out[Number(m[1])] = m[2].toUpperCase();
  return out;
}

// Read "Truck: KDA 767C;" from notes (used for imported rows with no vehicle_id yet)
function truckFromNotes(notes?: string | null): string | null {
  const m = notes?.match(/Truck:\s*([^;]+)/);
  return m ? m[1].trim() : null;
}

const tripWeights = (t: any): number[] =>
  TRIP_NUMS.map(n => Number(t[`trip_${n}`]) || 0);

const tripCount = (t: any) => tripWeights(t).filter(w => w > 0).length;

const tonsOf = (t: any) => {
  const sum = tripWeights(t).reduce((a, b) => a + b, 0);
  return sum > 0 ? sum / 1000 : Number(t.net_tallage) || 0;
};

type FormState = {
  trip_date: string;
  vehicle_id: string;
  driver_id: string;
  status: string;
  notes: string;
  weights: Record<number, string>; // kg per trip, as typed
  sources: Record<number, string>; // M/G/N/S/T per trip
};

const emptyForm = (): FormState => ({
  trip_date: new Date().toISOString().split('T')[0],
  vehicle_id: '',
  driver_id: '',
  status: 'completed',
  notes: '',
  weights: {},
  sources: {},
});

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
  const [form, setForm] = useState<FormState>(emptyForm());

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
    setForm(emptyForm());
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (t: any) => {
    const weights: Record<number, string> = {};
    TRIP_NUMS.forEach(n => {
      const w = Number(t[`trip_${n}`]) || 0;
      if (w > 0) weights[n] = String(w);
    });
    setForm({
      trip_date: t.trip_date,
      vehicle_id: t.vehicle_id || '',
      driver_id: t.driver_id || '',
      status: t.status || 'completed',
      notes: t.notes || '',
      weights,
      sources: parseSources(t.notes),
    });
    setEditId(t.id);
    setModalOpen(true);
  };

  // Live totals shown inside the form
  const formWeights = TRIP_NUMS.map(n => Number(form.weights[n]) || 0);
  const formTrips = formWeights.filter(w => w > 0).length;
  const formTons = formWeights.reduce((a, b) => a + b, 0) / 1000;

  const save = async () => {
    if (!form.trip_date) { showToast('Please pick a date', 'error'); return; }
    setSaving(true);

    const payload: any = {
      sub_account: subAccount,
      trip_date: form.trip_date,
      vehicle_id: form.vehicle_id || null,
      driver_id: form.driver_id || null,
      status: form.status,
      net_tallage: Number(formTons.toFixed(2)),
    };
    TRIP_NUMS.forEach(n => { payload[`trip_${n}`] = Number(form.weights[n]) || 0; });

    // Areas used on this day -> departure_point (full names) and notes (per-trip codes)
    const used = TRIP_NUMS.filter(n => (Number(form.weights[n]) || 0) > 0 && form.sources[n]);
    const names: string[] = [];
    used.forEach(n => {
      const name = SOURCES[form.sources[n]];
      if (name && !names.includes(name)) names.push(name);
    });
    payload.departure_point = names.join(' / ');

    const plate = vehicles.find(v => v.id === form.vehicle_id)?.plate_number
      || truckFromNotes(form.notes);
    const parts: string[] = [];
    if (plate) parts.push(`Truck: ${plate}`);
    if (used.length) parts.push(`Sources: ${used.map(n => `Trip${n}=${form.sources[n]}`).join('; ')}`);
    payload.notes = parts.join('; ');

    // Cumulative totals for this truck within the same month (earlier days + today)
    const month = form.trip_date.slice(0, 7);
    const sameTruck = trips.filter(t =>
      t.id !== editId &&
      t.trip_date?.slice(0, 7) === month &&
      t.trip_date < form.trip_date &&
      (form.vehicle_id ? t.vehicle_id === form.vehicle_id : truckFromNotes(t.notes) === plate),
    );
    payload.cumulative_tons = Number((sameTruck.reduce((a, t) => a + tonsOf(t), 0) + formTons).toFixed(2));
    payload.cumulative_trips = sameTruck.reduce((a, t) => a + tripCount(t), 0) + formTrips;

    if (isMCL && mclArea) payload.mcl_area_id = mclArea;

    const { error } = editId
      ? await supabase.from('sub_account_trips').update(payload).eq('id', editId)
      : await supabase.from('sub_account_trips').insert([payload]);

    if (error) showToast('Failed to save: ' + error.message, 'error');
    else showToast(editId ? 'Daily log updated' : 'Daily log created', 'success');

    setSaving(false);
    if (!error) setModalOpen(false);
    loadData();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title={isMCL ? 'MCL Daily Trip Logs' : 'Trips'}
          subtitle={isMCL ? 'Daily loads per truck, material source, tons and cumulative totals' : 'Trip records and dispatch'}
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
          Bulk Import
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading trip logs..." />
      ) : visibleTrips.length === 0 ? (
        <div className="card">
          <EmptyState icon={<RouteIcon className="h-8 w-8" />} title="No trip logs found" message="Import your monthly sheet or add a daily log." />
        </div>
      ) : (
        <div className="card table-wrapper overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Date</th>
                <th>Truck</th>
                <th>Driver</th>
                <th>Areas</th>
                <th>Trips</th>
                <th>Tons</th>
                <th>Cum. Tons</th>
                <th>Cum. Trips</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleTrips.map(t => (
                <tr key={t.id}>
                  <td className="font-medium text-slate-700">{t.trip_date}</td>
                  <td className="font-bold text-slate-800">
                    {t.vehicle?.plate_number || truckFromNotes(t.notes) || '—'}
                  </td>
                  <td className="text-slate-600">{t.driver?.name || '—'}</td>
                  <td className="text-slate-600">{t.departure_point || '—'}</td>
                  <td className="font-semibold text-blue-700">{tripCount(t)}</td>
                  <td className="font-semibold text-emerald-700">{tonsOf(t).toFixed(2)} T</td>
                  <td className="text-slate-600">{Number(t.cumulative_tons || 0).toFixed(2)} T</td>
                  <td className="text-slate-600">{t.cumulative_trips || 0}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Daily Log' : 'Add Daily Log'} size="xl">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto p-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.trip_date} onChange={e => setForm({ ...form, trip_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Truck *</label>
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

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trips: weight (kg) and source area</h4>
            <p className="text-[11px] text-slate-400 mb-2">
              M = MCL Mines, G = Gas, N = Ngamani, S = Minor St/Pile, T = TEZZO (Ngamani)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {TRIP_NUMS.map(n => (
                <div key={n}>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Trip {n}</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      className="input text-xs py-1 px-1 w-full"
                      placeholder="kg"
                      value={form.weights[n] ?? ''}
                      onChange={e => setForm({ ...form, weights: { ...form.weights, [n]: e.target.value } })}
                    />
                    <select
                      className="input text-xs py-1 px-1 w-14"
                      value={form.sources[n] ?? ''}
                      onChange={e => setForm({ ...form, sources: { ...form.sources, [n]: e.target.value } })}
                    >
                      <option value="">–</option>
                      {Object.keys(SOURCES).map(k => <option key={k} value={k} title={SOURCES[k]}>{k}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm">
            <div><span className="text-slate-500">Trips today:</span> <b>{formTrips}</b></div>
            <div><span className="text-slate-500">Tons today:</span> <b>{formTons.toFixed(2)} T</b></div>
            <p className="col-span-2 text-[11px] text-slate-400">
              Tons and cumulative totals are calculated automatically when you save.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t pt-3">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary" style={{ background: portalColor }}>
            {saving ? 'Saving...' : 'Save Log'}
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
          'trip_date', 'departure_point',
          'trip_1', 'trip_2', 'trip_3', 'trip_4', 'trip_5', 'trip_6', 'trip_7',
          'trip_8', 'trip_9', 'trip_10', 'trip_11', 'trip_12', 'trip_13',
          'net_tallage', 'cumulative_tons', 'cumulative_trips', 'notes',
        ]}
        onSuccess={loadData}
      />
    </div>
  );
}
