import { useEffect, useState, useCallback, useMemo } from 'react';
import { Route as RouteIcon, Plus, Edit, Fuel, Wallet, TrendingUp, AlertTriangle, Download, Upload } from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { DocumentUpload } from '@/components/DocumentUpload';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount, MCLArea } from '@/lib/portals';
import { BulkImportModal } from '@/components/BulkImportModal';

export function SubAccountTrips({ mclArea, portalColor }: { mclArea: MCLArea | null; portalColor: string }) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const subAccount = (profile?.sub_account ?? getSubAccountFilter() ?? 'master') as SubAccount;
  const isTarmal = subAccount === 'tarmal';
  const isMCL = subAccount === 'mcl';

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routeRates, setRouteRates] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tripDocs, setTripDocs] = useState<string[]>([]);

  const emptyForm = {
    trip_date: new Date().toISOString().split('T')[0],
    vehicle_id: '',
    trailer_number: '',
    driver_id: '',
    departure_point: '',
    arrival_point: '',
    destination_city: '',
    net_tallage: null as number | null,
    fuel_expected: null as number | null,
    fuel_actual: null as number | null,
    status: 'planned' as string,
    notes: '',
  };

  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tripRes, vehRes, drvRes, rateRes] = await Promise.all([
      supabase.from('sub_account_trips')
        .select('*, vehicle:vehicles(plate_number, make, model), driver:drivers(name)')
        .order('trip_date', { ascending: false }),
      supabase.from('vehicles').select('id, plate_number, make, model').order('plate_number'),
      supabase.from('drivers').select('id, name').order('name'),
      supabase.from('route_rates').select('id, origin, destination, rate_amount, is_bidirectional'),
    ]);
    setTrips(tripRes.data || []);
    setVehicles(vehRes.data || []);
    setDrivers(drvRes.data || []);
    setRouteRates(rateRes.data || []);
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
    setTripDocs([]);
    setModalOpen(true);
  };

  const openEdit = (t: any) => {
    const { id, vehicle, driver, created_at, sub_account, mcl_area_id, documents, ...rest } = t;
    setForm(rest);
    setEditId(id);
    setTripDocs(documents || []);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload: any = { ...form };
    if (isMCL && mclArea) payload.mcl_area_id = mclArea;

    if (editId) {
      const { error } = await supabase.from('sub_account_trips').update(payload).eq('id', editId);
      if (error) showToast('Failed to save: ' + error.message, 'error');
      else showToast('Trip updated', 'success');
    } else {
      const { error } = await supabase.from('sub_account_trips').insert(payload);
      if (error) showToast('Failed to create: ' + error.message, 'error');
      else showToast('Trip created', 'success');
    }
    setSaving(false);
    setModalOpen(false);
    loadData();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title={isTarmal ? 'Long Distance Trips' : 'Trips'}
          subtitle="Trip records with fuel, mileage, and cost tracking"
          icon={<RouteIcon className="h-6 w-6" />}
          iconColor={portalColor}
          onAdd={openAdd}
          addLabel="Add Trip"
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
        <LoadingSpinner message="Loading trips..." />
      ) : visibleTrips.length === 0 ? (
        <div className="card"><EmptyState icon={<RouteIcon className="h-8 w-8" />} title="No trips found" message="Create a new trip to get started." /></div>
      ) : (
        <div className="card table-wrapper overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Truck</th><th>Driver</th><th>Departure</th><th>Arrival</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {visibleTrips.map(t => (
                <tr key={t.id}>
                  <td className="text-slate-600">{t.trip_date}</td>
                  <td className="font-semibold text-slate-800">{t.vehicle?.plate_number || '—'}</td>
                  <td className="text-slate-600">{t.driver?.name || '—'}</td>
                  <td className="text-slate-600">{t.departure_point || '—'}</td>
                  <td className="text-slate-600">{t.arrival_point || '—'}</td>
                  <td><span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase bg-blue-100 text-blue-700">{t.status}</span></td>
                  <td><button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Edit className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Trip' : 'Add Trip'} size="xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label">Trip Date *</label><input type="date" className="input" value={form.trip_date} onChange={e => setForm({ ...form, trip_date: e.target.value })} /></div>
          <div><label className="label">Truck *</label><select className="input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}><option value="">Select Truck</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}</select></div>
          <div><label className="label">Driver *</label><select className="input" value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })}><option value="">Select Driver</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Trip'}</button>
        </div>
      </Modal>

      <BulkImportModal
        open={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        tableName="sub_account_trips"
        portalColor={portalColor}
        subAccount={subAccount}
        sampleColumns={['trip_date', 'trailer_number', 'departure_point', 'arrival_point', 'net_tallage', 'status', 'notes']}
        onSuccess={loadData}
      />
    </div>
  );
}
