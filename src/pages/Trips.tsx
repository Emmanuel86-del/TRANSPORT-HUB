import { useEffect, useState, useCallback } from 'react';
import { Route as RouteIcon, Plus, Edit, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState } from '@/components/Shared';

interface Trip {
  id: string;
  trip_number: string;
  vehicle_id: string;
  vehicle?: { plate_number: string; make_model: string };
  driver_id: string;
  driver?: { name: string; phone: string };
  cargo_type: string;
  origin: string;
  destination: string;
  status: 'planned' | 'in_transit' | 'completed' | 'cancelled';
  start_date: string;
}

export function Trips() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  
  // Filter States
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedCargo, setSelectedCargo] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    trip_number: `TRP-${Math.floor(1000 + Math.random() * 9000)}`,
    vehicle_id: '',
    driver_id: '',
    cargo_type: '',
    origin: '',
    destination: '',
    status: 'planned' as const,
    start_date: new Date().toISOString().split('T')[0],
  };

  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tripRes, vehRes, drvRes] = await Promise.all([
      supabase.from('trips').select('*, vehicle:vehicles(plate_number, make_model), driver:drivers(name, phone)').order('start_date', { ascending: false }),
      supabase.from('vehicles').select('id, plate_number, make_model').order('plate_number'),
      supabase.from('drivers').select('id, name').order('name'),
    ]);
    setTrips(tripRes.data || []);
    setVehicles(vehRes.data || []);
    setDrivers(drvRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveTrip = async () => {
    setSaving(true);
    if (editId) {
      await supabase.from('trips').update(form).eq('id', editId);
    } else {
      await supabase.from('trips').insert(form);
    }
    setSaving(false);
    setModalOpen(false);
    loadData();
  };

  // Unique list of cargo types for the filter dropdown
  const uniqueCargoTypes = Array.from(new Set(trips.map(t => t.cargo_type).filter(Boolean)));

  // Filtered trips logic
  const filteredTrips = trips.filter(t => {
    const matchesVehicle = selectedVehicle ? t.vehicle_id === selectedVehicle : true;
    const matchesCargo = selectedCargo ? t.cargo_type === selectedCargo : true;
    return matchesVehicle && matchesCargo;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader 
        title="Trips & Dispatches" 
        subtitle="Manage active and historical vehicle trips, routes, and cargo allocations" 
        icon={<RouteIcon className="h-6 w-6" />} 
        onAdd={() => { setForm(emptyForm); setEditId(null); setModalOpen(true); }} 
        addLabel="Create New Trip" 
      />

      {/* Filter Controls Bar */}
      <div className="card flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Filters:</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Vehicle Filter */}
          <select 
            className="input text-sm py-1.5 w-full sm:w-48" 
            value={selectedVehicle} 
            onChange={e => setSelectedVehicle(e.target.value)}
          >
            <option value="">All Vehicles</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.plate_number} ({v.make_model})</option>
            ))}
          </select>

          {/* Cargo Type Filter */}
          <select 
            className="input text-sm py-1.5 w-full sm:w-48" 
            value={selectedCargo} 
            onChange={e => setSelectedCargo(e.target.value)}
          >
            <option value="">All Cargo Types</option>
            {uniqueCargoTypes.map(cargo => (
              <option key={cargo} value={cargo}>{cargo}</option>
            ))}
          </select>

          {(selectedVehicle || selectedCargo) && (
            <button 
              onClick={() => { setSelectedVehicle(''); setSelectedCargo(''); }}
              className="text-xs text-blue-600 hover:underline font-medium whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading trips..." />
      ) : filteredTrips.length === 0 ? (
        <div className="card">
          <EmptyState 
            icon={<RouteIcon className="h-8 w-8" />} 
            title="No matching trips found" 
            message="Try adjusting your vehicle or cargo type filters, or add a new trip." 
          />
        </div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trip Number</th>
                <th>Vehicle Plate</th>
                <th>Driver</th>
                <th>Cargo Type</th>
                <th>Route (Origin → Destination)</th>
                <th>Status</th>
                <th>Start Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map(t => (
                <tr key={t.id}>
                  <td className="font-bold text-slate-800">{t.trip_number}</td>
                  <td>{t.vehicle?.plate_number || '—'} <span className="block text-xs text-slate-400">{t.vehicle?.make_model}</span></td>
                  <td>{t.driver?.name || '—'}</td>
                  <td>
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700">
                      {t.cargo_type || 'General'}
                    </span>
                  </td>
                  <td>{t.origin} → {t.destination}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                      t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      t.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                      t.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{t.start_date}</td>
                  <td>
                    <button 
                      onClick={() => {
                        const { id, vehicle, driver, ...rest } = t as any;
                        setForm(rest);
                        setEditId(id);
                        setModalOpen(true);
                      }} 
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Trip' : 'Create New Trip'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Trip Number *</label>
            <input type="text" className="input" value={form.trip_number} onChange={e => setForm({ ...form, trip_number: e.target.value })} />
          </div>

          <div>
            <label className="label">Cargo Type *</label>
            <input type="text" className="input" value={form.cargo_type} onChange={e => setForm({ ...form, cargo_type: e.target.value })} placeholder="e.g. Bulk Cement, Fuel, Container" />
          </div>

          <div>
            <label className="label">Vehicle *</label>
            <select className="input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">Select Vehicle Plate</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} ({v.make_model})</option>)}
            </select>
          </div>

          <div>
            <label className="label">Driver *</label>
            <select className="input" value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })}>
              <option value="">Select Driver</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Origin *</label>
            <input type="text" className="input" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} placeholder="e.g. Mombasa Port" />
          </div>

          <div>
            <label className="label">Destination *</label>
            <input type="text" className="input" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="e.g. Nairobi Depot" />
          </div>

          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
              <option value="planned">Planned</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={saveTrip} disabled={saving || !form.trip_number} className="btn-primary">{saving ? 'Saving...' : 'Save Trip'}</button>
        </div>
      </Modal>
    </div>
  );
}
