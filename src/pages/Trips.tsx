import { useEffect, useState, useCallback } from 'react';
import { Route, Search, Trash2, Edit, Filter, Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Trip, Driver, Vehicle, TripInsert, RouteRate } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

const statusBadge = (status: string) => {
  switch (status) {
    case 'completed': return <span className="badge-success">Completed</span>;
    case 'in_progress': return <span className="badge-info">In Progress</span>;
    case 'scheduled': return <span className="badge-warning">Scheduled</span>;
    case 'cancelled': return <span className="badge-danger">Cancelled</span>;
    default: return <span className="badge-neutral">{status}</span>;
  }
};

const emptyForm: TripInsert = {
  trip_date: new Date().toISOString().slice(0, 10),
  driver_id: null,
  vehicle_id: null,
  origin: '',
  destination: '',
  distance_km: null,
  fuel_liters: null,
  fuel_cost: null,
  freight_amount: null,
  other_costs: 0,
  status: 'scheduled',
  cargo_description: '',
  departure_time: '',
  arrival_time: '',
  notes: '',
  cargo_type: 'general',
  container_state: null,
  trip_sequence: '1st',
  delivery_or_container_no: '',
  from_location: '',
  to_location: '',
  weight_kg: null,
  mileage_payment: null,
};

export function Trips() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TripInsert>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<number | null>(null);
  const [calcInfo, setCalcInfo] = useState<string>('');
  const [todayTripCount, setTodayTripCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [tripsRes, driversRes, vehiclesRes, allVehiclesRes] = await Promise.all([
      supabase.from('trips').select('*, driver:drivers(*), vehicle:vehicles(*)').order('trip_date', { ascending: false }),
      supabase.from('drivers').select('*').eq('status', 'active'),
      supabase.from('vehicles').select('*').eq('status', 'active'),
      supabase.from('vehicles').select('*'),
    ]);
    setTrips(tripsRes.data || []);
    setDrivers(driversRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setAllVehicles(allVehiclesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-calculate trip sequence for today based on vehicle + date
  const autoCalcTripSequence = useCallback(async (vehicleId: string | null, tripDate: string, excludeId: string | null) => {
    if (!vehicleId || !tripDate) return;
    let query = supabase.from('trips').select('id').eq('vehicle_id', vehicleId).eq('trip_date', tripDate);
    if (excludeId) query = query.neq('id', excludeId);
    const { count } = await query;
    const countNum = count || 0;
    setTodayTripCount(countNum);
    const seq = countNum >= 2 ? '3rd_plus' : countNum === 1 ? '2nd' : '1st';
    setForm(prev => ({ ...prev, trip_sequence: seq }));
  }, []);

  // Payment calculator: look up route_rates
  const calculatePayment = useCallback(async () => {
    const { origin, destination, cargo_type, container_state, trip_sequence, from_location, to_location } = form;
    const useOrigin = from_location || origin;
    const useDest = to_location || destination;
    if (!useOrigin || !useDest || !trip_sequence) {
      setCalcResult(null);
      setCalcInfo('');
      return;
    }

    // Try direct match first, then reverse (bidirectional)
    const { data: directMatch } = await supabase
      .from('route_rates')
      .select('*')
      .eq('origin', useOrigin)
      .eq('destination', useDest)
      .eq('cargo_type', cargo_type || 'general')
      .eq('trip_sequence', trip_sequence);

    let match = (directMatch || []).find(r => r.container_state === container_state) || (directMatch || []).find(r => r.container_state === null) || (directMatch || [])[0];

    if (!match) {
      const { data: reverseMatch } = await supabase
        .from('route_rates')
        .select('*')
        .eq('origin', useDest)
        .eq('destination', useOrigin)
        .eq('cargo_type', cargo_type || 'general')
        .eq('trip_sequence', trip_sequence)
        .eq('is_bidirectional', true);

      match = (reverseMatch || []).find(r => r.container_state === container_state) || (reverseMatch || []).find(r => r.container_state === null) || (reverseMatch || [])[0];
    }

    if (match) {
      setCalcResult(match.rate_amount);
      const direction = match.origin === useOrigin ? `${match.origin} → ${match.destination}` : `${match.destination} → ${match.origin}`;
      setCalcInfo(`Matched: ${direction} · ${match.cargo_type}${match.container_state ? ` (${match.container_state})` : ''} · ${trip_sequence === '3rd_plus' ? '3rd+' : trip_sequence} trip`);
      setForm(prev => ({ ...prev, mileage_payment: match.rate_amount }));
    } else {
      setCalcResult(null);
      setCalcInfo('No matching rate found — enter payment manually');
    }
  }, [form]);

  // Recalculate when key fields change
  useEffect(() => {
    if (modalOpen) calculatePayment();
  }, [modalOpen, form.from_location, form.to_location, form.origin, form.destination, form.cargo_type, form.container_state, form.trip_sequence, calculatePayment]);

  const filtered = trips.filter(t => {
    const matchSearch = !search ||
      t.origin?.toLowerCase().includes(search.toLowerCase()) ||
      t.destination?.toLowerCase().includes(search.toLowerCase()) ||
      t.from_location?.toLowerCase().includes(search.toLowerCase()) ||
      t.to_location?.toLowerCase().includes(search.toLowerCase()) ||
      t.driver?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.delivery_or_container_no?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setCalcResult(null);
    setCalcInfo('');
    setTodayTripCount(0);
    setModalOpen(true);
  };

  const openEdit = (trip: Trip) => {
    const { id, created_at, driver, vehicle, ...rest } = trip;
    setForm(rest);
    setEditId(id);
    setCalcResult(null);
    setCalcInfo('');
    setModalOpen(true);
    if (rest.vehicle_id) autoCalcTripSequence(rest.vehicle_id, rest.trip_date, id);
  };

  const save = async () => {
    setSaving(true);
    const data = {
      ...form,
      driver_id: form.driver_id || null,
      vehicle_id: form.vehicle_id || null,
    };
    if (editId) {
      await supabase.from('trips').update(data).eq('id', editId);
    } else {
      await supabase.from('trips').insert(data);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('trips').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const update = <K extends keyof TripInsert>(key: K, value: TripInsert[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleVehicleChange = (vehicleId: string | null) => {
    update('vehicle_id', vehicleId);
    autoCalcTripSequence(vehicleId, form.trip_date, editId);
  };

  const handleDateChange = (date: string) => {
    update('trip_date', date);
    if (form.vehicle_id) autoCalcTripSequence(form.vehicle_id, date, editId);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Trips" subtitle="Manage and track all transport trips" icon={<Route className="h-6 w-6" />} onAdd={openAdd} addLabel="New Trip" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search by route, driver, container no..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading trips..." />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Route className="h-8 w-8" />} title="No trips found" message="Create your first trip to start tracking transport operations." />
        </div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Route</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Cargo Type</th>
                <th>Seq</th>
                <th>Mileage Pay</th>
                <th>Freight</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(trip => (
                <tr key={trip.id}>
                  <td className="font-medium text-slate-800 whitespace-nowrap">{trip.trip_date}</td>
                  <td>
                    <span className="text-slate-700">{trip.from_location || trip.origin || '—'}</span>
                    <span className="text-slate-400 mx-1">→</span>
                    <span className="text-slate-700">{trip.to_location || trip.destination || '—'}</span>
                  </td>
                  <td>{trip.driver?.name || <span className="text-slate-400">Unassigned</span>}</td>
                  <td>{trip.vehicle ? `${trip.vehicle.plate_number}` : <span className="text-slate-400">—</span>}</td>
                  <td className="capitalize text-slate-600">{trip.cargo_type || 'general'}</td>
                  <td className="text-slate-600">{trip.trip_sequence === '3rd_plus' ? '3rd+' : trip.trip_sequence || '—'}</td>
                  <td className="font-semibold text-blue-600">{trip.mileage_payment ? `${trip.mileage_payment.toLocaleString()} KES` : '—'}</td>
                  <td className="font-semibold text-emerald-600">{trip.freight_amount ? `${trip.freight_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</td>
                  <td>{statusBadge(trip.status)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(trip)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(trip.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Trip' : 'New Trip'} size="xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* --- Basic Info --- */}
          <div className="sm:col-span-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 mb-3">Basic Trip Info</h4>
          </div>
          <div>
            <label className="label">Trip Date</label>
            <input type="date" className="input" value={form.trip_date} onChange={e => handleDateChange(e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="label">Driver</label>
            <select className="input" value={form.driver_id || ''} onChange={e => update('driver_id', e.target.value || null)}>
              <option value="">Unassigned</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Vehicle</label>
            <select className="input" value={form.vehicle_id || ''} onChange={e => handleVehicleChange(e.target.value || null)}>
              <option value="">Unassigned</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Delivery / Container No.</label>
            <input className="input" value={form.delivery_or_container_no || ''} onChange={e => update('delivery_or_container_no', e.target.value)} placeholder="e.g., CONT-2026-001" />
          </div>
          <div>
            <label className="label">Weight (kg)</label>
            <input type="number" className="input" value={form.weight_kg ?? ''} onChange={e => update('weight_kg', e.target.value ? Number(e.target.value) : null)} />
          </div>

          {/* --- Dispatch Locations --- */}
          <div className="sm:col-span-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 mb-3 mt-2">Dispatch Locations</h4>
          </div>
          <div>
            <label className="label">From Location</label>
            <input className="input" value={form.from_location || ''} onChange={e => update('from_location', e.target.value)} placeholder="e.g., MICD" />
          </div>
          <div>
            <label className="label">To Location</label>
            <input className="input" value={form.to_location || ''} onChange={e => update('to_location', e.target.value)} placeholder="e.g., CSL" />
          </div>
          <div>
            <label className="label">Origin (general)</label>
            <input className="input" value={form.origin || ''} onChange={e => update('origin', e.target.value)} placeholder="e.g., Nairobi" />
          </div>
          <div>
            <label className="label">Destination (general)</label>
            <input className="input" value={form.destination || ''} onChange={e => update('destination', e.target.value)} placeholder="e.g., Mombasa" />
          </div>
          <div>
            <label className="label">Distance (km)</label>
            <input type="number" className="input" value={form.distance_km ?? ''} onChange={e => update('distance_km', e.target.value ? Number(e.target.value) : null)} />
          </div>

          {/* --- Payment Calculator --- */}
          <div className="sm:col-span-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 mb-3 mt-2 flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5" /> Payment Calculator
            </h4>
          </div>
          <div>
            <label className="label">Cargo Type</label>
            <select className="input" value={form.cargo_type || 'general'} onChange={e => {
              const val = e.target.value;
              setForm(prev => ({ ...prev, cargo_type: val, container_state: val === 'general' ? null : prev.container_state }));
            }}>
              <option value="general">General</option>
              <option value="container">Container</option>
            </select>
          </div>
          <div>
            <label className="label">Container State</label>
            <select className="input" value={form.container_state || ''} onChange={e => update('container_state', e.target.value || null)} disabled={form.cargo_type === 'general'}>
              <option value="">N/A</option>
              <option value="empty">Empty</option>
              <option value="loaded">Loaded</option>
            </select>
          </div>
          <div>
            <label className="label">Trip Sequence {todayTripCount > 0 && <span className="text-xs text-blue-500 ml-1">({todayTripCount} trip(s) today for this truck)</span>}</label>
            <select className="input" value={form.trip_sequence || '1st'} onChange={e => update('trip_sequence', e.target.value)}>
              <option value="1st">1st Trip</option>
              <option value="2nd">2nd Trip</option>
              <option value="3rd_plus">3rd+ Trip</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            {calcInfo && (
              <div className={`rounded-lg px-4 py-2.5 text-sm flex items-center justify-between ${calcResult !== null ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                <span>{calcInfo}</span>
                {calcResult !== null && <span className="font-bold text-base">{calcResult.toLocaleString()} KES</span>}
              </div>
            )}
          </div>
          <div className="sm:col-span-3">
            <label className="label">Mileage Payment (KES) — auto-calculated, editable</label>
            <input type="number" className="input" value={form.mileage_payment ?? ''} onChange={e => update('mileage_payment', e.target.value ? Number(e.target.value) : null)} placeholder="Auto-filled from rate matrix or enter manually" />
          </div>

          {/* --- Costs & Times --- */}
          <div className="sm:col-span-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 mb-3 mt-2">Costs & Times</h4>
          </div>
          <div>
            <label className="label">Fuel (Liters)</label>
            <input type="number" className="input" value={form.fuel_liters ?? ''} onChange={e => update('fuel_liters', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Fuel Cost (KES)</label>
            <input type="number" className="input" value={form.fuel_cost ?? ''} onChange={e => update('fuel_cost', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Freight Amount (KES)</label>
            <input type="number" className="input" value={form.freight_amount ?? ''} onChange={e => update('freight_amount', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Other Costs (KES)</label>
            <input type="number" className="input" value={form.other_costs ?? 0} onChange={e => update('other_costs', e.target.value ? Number(e.target.value) : 0)} />
          </div>
          <div>
            <label className="label">Departure Time</label>
            <input className="input" value={form.departure_time || ''} onChange={e => update('departure_time', e.target.value)} placeholder="e.g., 08:00" />
          </div>
          <div>
            <label className="label">Arrival Time</label>
            <input className="input" value={form.arrival_time || ''} onChange={e => update('arrival_time', e.target.value)} placeholder="e.g., 16:00" />
          </div>
          <div>
            <label className="label">Cargo Description</label>
            <input className="input" value={form.cargo_description || ''} onChange={e => update('cargo_description', e.target.value)} placeholder="e.g., Construction materials" />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes || ''} onChange={e => update('notes', e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : editId ? 'Update Trip' : 'Create Trip'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Trip" message="Are you sure you want to delete this trip? This action cannot be undone." onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
