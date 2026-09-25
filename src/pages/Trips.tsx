import { useEffect, useState, useCallback } from 'react';
import { Route, Search, Trash2, Edit, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Trip, Driver, Vehicle, TripInsert } from '@/types';
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
};

export function Trips() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TripInsert>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tripsRes, driversRes, vehiclesRes] = await Promise.all([
      supabase.from('trips').select('*, driver:drivers(*), vehicle:vehicles(*)').order('trip_date', { ascending: false }),
      supabase.from('drivers').select('*').eq('status', 'active'),
      supabase.from('vehicles').select('*').eq('status', 'active'),
    ]);
    setTrips(tripsRes.data || []);
    setDrivers(driversRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = trips.filter(t => {
    const matchSearch = !search ||
      t.origin?.toLowerCase().includes(search.toLowerCase()) ||
      t.destination?.toLowerCase().includes(search.toLowerCase()) ||
      t.driver?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.cargo_description?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (trip: Trip) => {
    const { id, created_at, driver, vehicle, ...rest } = trip;
    setForm(rest);
    setEditId(id);
    setModalOpen(true);
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

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Trips"
        subtitle="Manage and track all transport trips"
        icon={<Route className="h-6 w-6" />}
        onAdd={openAdd}
        addLabel="New Trip"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by route, driver, or cargo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
                <th>Distance</th>
                <th>Freight</th>
                <th>Fuel Cost</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(trip => (
                <tr key={trip.id}>
                  <td className="font-medium text-slate-800 whitespace-nowrap">{trip.trip_date}</td>
                  <td>
                    <span className="text-slate-700">{trip.origin || '—'}</span>
                    <span className="text-slate-400 mx-1">→</span>
                    <span className="text-slate-700">{trip.destination || '—'}</span>
                  </td>
                  <td>{trip.driver?.name || <span className="text-slate-400">Unassigned</span>}</td>
                  <td>{trip.vehicle ? `${trip.vehicle.plate_number}` : <span className="text-slate-400">—</span>}</td>
                  <td>{trip.distance_km ? `${trip.distance_km} km` : '—'}</td>
                  <td className="font-semibold text-emerald-600">{trip.freight_amount ? `$${trip.freight_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</td>
                  <td className="text-amber-600">{trip.fuel_cost ? `$${trip.fuel_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Trip' : 'New Trip'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Trip Date</label>
            <input type="date" className="input" value={form.trip_date} onChange={e => update('trip_date', e.target.value)} />
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
            <select className="input" value={form.vehicle_id || ''} onChange={e => update('vehicle_id', e.target.value || null)}>
              <option value="">Unassigned</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Origin</label>
            <input className="input" value={form.origin || ''} onChange={e => update('origin', e.target.value)} placeholder="e.g., Nairobi" />
          </div>
          <div>
            <label className="label">Destination</label>
            <input className="input" value={form.destination || ''} onChange={e => update('destination', e.target.value)} placeholder="e.g., Mombasa" />
          </div>
          <div>
            <label className="label">Distance (km)</label>
            <input type="number" className="input" value={form.distance_km ?? ''} onChange={e => update('distance_km', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Cargo Description</label>
            <input className="input" value={form.cargo_description || ''} onChange={e => update('cargo_description', e.target.value)} placeholder="e.g., Construction materials" />
          </div>
          <div>
            <label className="label">Fuel (Liters)</label>
            <input type="number" className="input" value={form.fuel_liters ?? ''} onChange={e => update('fuel_liters', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Fuel Cost ($)</label>
            <input type="number" className="input" value={form.fuel_cost ?? ''} onChange={e => update('fuel_cost', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Freight Amount ($)</label>
            <input type="number" className="input" value={form.freight_amount ?? ''} onChange={e => update('freight_amount', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Other Costs ($)</label>
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
          <div className="sm:col-span-2">
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

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Trip"
        message="Are you sure you want to delete this trip? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
