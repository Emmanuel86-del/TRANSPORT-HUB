import { useEffect, useState, useCallback, useMemo } from 'react';
import { Route as RouteIcon, Plus, Edit, Fuel, Wallet, TrendingUp, AlertTriangle, Truck } from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { DocumentUpload } from '@/components/DocumentUpload';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount, MCLArea } from '@/lib/portals';

interface SubTrip {
  id: string;
  sub_account: string;
  mcl_area_id: string | null;
  trip_date: string;
  vehicle_id: string | null;
  trailer_number: string | null;
  driver_id: string | null;
  departure_point: string | null;
  arrival_point: string | null;
  destination_city: string | null;
  net_tallage: number | null;
  fuel_expected: number | null;
  fuel_actual: number | null;
  fuel_date: string | null;
  trips_since_refuel: number | null;
  fuel_cost: number | null;
  mileage_payment: number | null;
  labour_cost: number | null;
  other_costs: number | null;
  start_odometer: number | null;
  end_odometer: number | null;
  distance_km: number | null;
  status: string;
  notes: string | null;
  documents: string[] | null;
  vehicle?: { plate_number: string; make: string | null; model: string | null } | null;
  driver?: { name: string } | null;
}

interface RouteRate {
  id: string;
  origin: string;
  destination: string;
  rate_amount: number;
  is_bidirectional: boolean;
}

export function SubAccountTrips({ mclArea, portalColor }: { mclArea: MCLArea | null; portalColor: string }) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const subAccount = (profile?.sub_account ?? getSubAccountFilter() ?? 'master') as SubAccount;
  const isTahmal = subAccount === 'tarmal';
  const isMCL = subAccount === 'mcl';

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<SubTrip[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routeRates, setRouteRates] = useState<RouteRate[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
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
    fuel_date: '' as string,
    trips_since_refuel: null as number | null,
    fuel_cost: null as number | null,
    mileage_payment: null as number | null,
    labour_cost: null as number | null,
    other_costs: null as number | null,
    start_odometer: null as number | null,
    end_odometer: null as number | null,
    distance_km: null as number | null,
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
    setTrips(tripRes.data as SubTrip[] || []);
    setVehicles(vehRes.data || []);
    setDrivers(drvRes.data || []);
    setRouteRates(rateRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter trips for MCL by area
  const visibleTrips = useMemo(() => {
    if (isMCL && mclArea) {
      return trips.filter(t => t.mcl_area_id === mclArea);
    }
    return trips;
  }, [trips, isMCL, mclArea]);

  // Summary cards — current month
  const summary = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTrips = visibleTrips.filter(t => t.trip_date?.startsWith(monthStr));

    const totalTrips = monthTrips.length;
    const totalFuelActual = monthTrips.reduce((sum, t) => sum + (t.fuel_actual ?? 0), 0);
    const totalFuelExpected = monthTrips.reduce((sum, t) => sum + (t.fuel_expected ?? 0), 0);
    const fuelVariance = totalFuelActual - totalFuelExpected;
    const fuelVariancePct = totalFuelExpected > 0 ? (fuelVariance / totalFuelExpected) * 100 : 0;
    const totalMileage = monthTrips.reduce((sum, t) => sum + (t.mileage_payment ?? 0), 0);
    const totalLabour = monthTrips.reduce((sum, t) => sum + (t.labour_cost ?? 0), 0);

    return { totalTrips, totalFuelActual, fuelVariance, fuelVariancePct, totalMileage, totalLabour };
  }, [visibleTrips]);

  // Mileage payment auto-lookup from route_rates (bidirectional)
  const lookupMileagePayment = useCallback((origin: string, destination: string): number | null => {
    if (!origin || !destination) return null;
    const match = routeRates.find(r => {
      if (r.is_bidirectional) {
        return (r.origin === origin && r.destination === destination) ||
               (r.origin === destination && r.destination === origin);
      }
      return r.origin === origin && r.destination === destination;
    });
    return match ? Number(match.rate_amount) : null;
  }, [routeRates]);

  const handleDepartureArrivalChange = (departure: string, arrival: string) => {
    const newForm = { ...form, departure_point: departure, arrival_point: arrival };
    const mileage = lookupMileagePayment(departure, arrival);
    if (mileage !== null) {
      newForm.mileage_payment = mileage;
    }
    setForm(newForm);
  };

  const handleOdometerChange = (start: number | null, end: number | null) => {
    const dist = start !== null && end !== null && end >= start ? end - start : null;
    setForm(prev => ({ ...prev, start_odometer: start, end_odometer: end, distance_km: dist }));
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setTripDocs([]);
    setModalOpen(true);
  };

  const openEdit = (t: SubTrip) => {
    const { id, vehicle, driver, created_at, sub_account, mcl_area_id, documents, ...rest } = t as any;
    setForm(rest);
    setEditId(id);
    setTripDocs(documents || []);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload: any = { ...form };
    if (isMCL && mclArea) {
      payload.mcl_area_id = mclArea;
    }
    // TAHMAL: auto-calc distance
    if (isTahmal && payload.start_odometer != null && payload.end_odometer != null) {
      payload.distance_km = payload.end_odometer - payload.start_odometer;
    }

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

  const fmtKES = (n: number | null) => n != null ? `${n.toLocaleString()}` : '—';
  const fmtNum = (n: number | null) => n != null ? n.toLocaleString() : '—';

  const statusBadge = (status: string) => {
    const cls = status === 'completed' ? 'bg-emerald-100 text-emerald-700'
      : status === 'in_transit' ? 'bg-blue-100 text-blue-700'
      : status === 'cancelled' ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${cls}`}>{status.replace('_', ' ')}</span>;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={isTahmal ? 'Long Distance Trips' : 'Trips'}
        subtitle={isMCL && mclArea ? `MCL — ${mclArea.charAt(0).toUpperCase() + mclArea.slice(1)} area operations` : 'Trip records with fuel, mileage, and cost tracking'}
        icon={<RouteIcon className="h-6 w-6" />}
        iconColor={portalColor}
        onAdd={openAdd}
        addLabel="Add Trip"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <RouteIcon className="h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-400">Trips This Month</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{summary.totalTrips}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Fuel className="h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-400">Actual Fuel (L)</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{fmtNum(summary.totalFuelActual)}</p>
        </div>
        <div className={`card p-4 ${summary.fuelVariancePct > 10 ? 'border-red-300 bg-red-50' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            {summary.fuelVariancePct > 10 ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <TrendingUp className="h-4 w-4 text-slate-400" />}
            <p className="text-xs text-slate-400">Fuel Variance</p>
          </div>
          <p className={`text-2xl font-bold ${summary.fuelVariancePct > 10 ? 'text-red-600' : 'text-slate-800'}`}>
            {summary.fuelVariance > 0 ? '+' : ''}{fmtNum(summary.fuelVariance)}
          </p>
          {summary.fuelVariancePct > 10 && <p className="text-xs text-red-500 font-medium">Over 10% expected</p>}
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-400">Mileage Pay (KES)</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{fmtKES(summary.totalMileage)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-400">Labour (KES)</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{fmtKES(summary.totalLabour)}</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading trips..." />
      ) : visibleTrips.length === 0 ? (
        <div className="card">
          <EmptyState icon={<RouteIcon className="h-8 w-8" />} title="No trips found" message="Create a new trip to get started." />
        </div>
      ) : (
        <div className="card table-wrapper overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Truck</th>
                <th>Trailer</th>
                <th>Driver</th>
                <th>Departure</th>
                <th>Arrival</th>
                <th>Net Tallage</th>
                <th>Fuel Exp (L)</th>
                <th>Fuel Act (L)</th>
                <th>Mileage Pay</th>
                <th>Docs</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleTrips.map(t => (
                <tr key={t.id}>
                  <td className="text-slate-600 whitespace-nowrap">{t.trip_date}</td>
                  <td className="font-semibold text-slate-800">{t.vehicle?.plate_number || '—'}</td>
                  <td className="text-slate-600">{t.trailer_number || '—'}</td>
                  <td className="text-slate-600">{t.driver?.name || '—'}</td>
                  <td className="text-slate-600">{t.departure_point || '—'}</td>
                  <td className="text-slate-600">{t.arrival_point || '—'}</td>
                  <td className="text-slate-600">{fmtNum(t.net_tallage)}</td>
                  <td className="text-slate-600">{fmtNum(t.fuel_expected)}</td>
                  <td className={`font-medium ${t.fuel_actual != null && t.fuel_expected != null && t.fuel_actual > t.fuel_expected * 1.1 ? 'text-red-600' : 'text-slate-600'}`}>
                    {fmtNum(t.fuel_actual)}
                  </td>
                  <td className="text-slate-600">{fmtKES(t.mileage_payment)}</td>
                  <td>
                    {t.documents && t.documents.length > 0 ? (
                      <span className="text-blue-600 text-xs font-medium">{t.documents.length} file{t.documents.length > 1 ? 's' : ''}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td>{statusBadge(t.status)}</td>
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

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Trip' : 'Add Trip'} size="xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Trip Date *</label>
            <input type="date" className="input" value={form.trip_date} onChange={e => setForm({ ...form, trip_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Truck *</label>
            <select className="input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">Select Truck</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} ({v.make} {v.model})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Trailer Number</label>
            <input type="text" className="input" value={form.trailer_number} onChange={e => setForm({ ...form, trailer_number: e.target.value })} placeholder="e.g. TZ 4567" />
          </div>
          <div>
            <label className="label">Driver *</label>
            <select className="input" value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })}>
              <option value="">Select Driver</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Departure Point</label>
            <input type="text" className="input" value={form.departure_point} onChange={e => handleDepartureArrivalChange(e.target.value, form.arrival_point)} placeholder="e.g. MICD" />
          </div>
          <div>
            <label className="label">Arrival Point</label>
            <input type="text" className="input" value={form.arrival_point} onChange={e => handleDepartureArrivalChange(form.departure_point, e.target.value)} placeholder="e.g. CSL" />
          </div>

          {isTahmal && (
            <>
              <div>
                <label className="label">Destination City/Town</label>
                <input type="text" className="input" value={form.destination_city} onChange={e => setForm({ ...form, destination_city: e.target.value })} placeholder="e.g. Nairobi" />
              </div>
              <div>
                <label className="label">Start Odometer</label>
                <input type="number" className="input" value={form.start_odometer ?? ''} onChange={e => handleOdometerChange(e.target.value ? Number(e.target.value) : null, form.end_odometer)} />
              </div>
              <div>
                <label className="label">End Odometer</label>
                <input type="number" className="input" value={form.end_odometer ?? ''} onChange={e => handleOdometerChange(form.start_odometer, e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label className="label">Distance KM (auto)</label>
                <input type="number" className="input bg-slate-50" value={form.distance_km ?? ''} readOnly />
              </div>
            </>
          )}

          <div>
            <label className="label">Net Tallage</label>
            <input type="number" step="0.01" className="input" value={form.net_tallage ?? ''} onChange={e => setForm({ ...form, net_tallage: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Fuel Expected (L)</label>
            <input type="number" step="0.01" className="input" value={form.fuel_expected ?? ''} onChange={e => setForm({ ...form, fuel_expected: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Fuel Actual (L)</label>
            <input type="number" step="0.01" className="input" value={form.fuel_actual ?? ''} onChange={e => setForm({ ...form, fuel_actual: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Fuel Date</label>
            <input type="date" className="input" value={form.fuel_date} onChange={e => setForm({ ...form, fuel_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Trips Since Last Refuel</label>
            <input type="number" className="input" value={form.trips_since_refuel ?? ''} onChange={e => setForm({ ...form, trips_since_refuel: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Fuel Cost (KES)</label>
            <input type="number" step="0.01" className="input" value={form.fuel_cost ?? ''} onChange={e => setForm({ ...form, fuel_cost: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Mileage Payment (KES)</label>
            <input type="number" step="0.01" className="input bg-slate-50" value={form.mileage_payment ?? ''} onChange={e => setForm({ ...form, mileage_payment: e.target.value ? Number(e.target.value) : null })} placeholder="Auto from rate matrix" />
          </div>
          <div>
            <label className="label">Labour Cost (KES)</label>
            <input type="number" step="0.01" className="input" value={form.labour_cost ?? ''} onChange={e => setForm({ ...form, labour_cost: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Other Costs (KES)</label>
            <input type="number" step="0.01" className="input" value={form.other_costs ?? ''} onChange={e => setForm({ ...form, other_costs: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="planned">Planned</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DocumentUpload
          folder="sub_account_trips"
          recordId={editId || 'unsaved'}
          existingDocs={tripDocs}
          onDocsChange={setTripDocs}
        />

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Trip' : 'Save Trip'}</button>
        </div>
      </Modal>
    </div>
  );
}
