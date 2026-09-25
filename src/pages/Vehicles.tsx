import { useEffect, useState, useCallback } from 'react';
import { Truck, Search, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Vehicle, VehicleInsert, Driver, Employee } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

const statusBadge = (status: string) => {
  switch (status) {
    case 'active': return <span className="badge-success">Active</span>;
    case 'maintenance': return <span className="badge-warning">Maintenance</span>;
    case 'retired': return <span className="badge-neutral">Retired</span>;
    default: return <span className="badge-neutral">{status}</span>;
  }
};

const emptyForm: VehicleInsert = {
  plate_number: '',
  make: '',
  model: '',
  year: null,
  capacity_kg: null,
  fuel_type: 'diesel',
  status: 'active',
  current_odometer: 0,
  last_service_date: null,
  trailer_number: null,
  notes: '',
};

type FleetRosterRow = {
  vehicle: Vehicle;
  driver: Driver | null;
  employee: Employee | null;
};

export function Vehicles() {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleInsert>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fleet' | 'roster'>('fleet');
  const [roster, setRoster] = useState<FleetRosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    setVehicles(data || []);
    setLoading(false);
  }, []);

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    const [vehicleRes, tripRes, driverRes, employeeRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('plate_number'),
      supabase.from('trips').select('vehicle_id, driver_id').in('status', ['in_progress', 'scheduled']).order('trip_date', { ascending: false }),
      supabase.from('drivers').select('*'),
      supabase.from('employees').select('*'),
    ]);

    const vehiclesList = vehicleRes.data || [];
    const driversList = driverRes.data || [];
    const employeesList = employeeRes.data || [];

    const latestTripByVehicle = new Map<string, string>();
    for (const t of tripRes.data || []) {
      if (t.vehicle_id && !latestTripByVehicle.has(t.vehicle_id)) {
        latestTripByVehicle.set(t.vehicle_id, t.driver_id);
      }
    }

    const rows: FleetRosterRow[] = vehiclesList.map(v => {
      const driverId = latestTripByVehicle.get(v.id);
      const driver = driverId ? driversList.find(d => d.id === driverId) || null : null;
      const employee = driver ? employeesList.find(e => e.name === driver.name) || null : null;
      return { vehicle: v, driver, employee };
    });
    setRoster(rows);
    setRosterLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'fleet') load();
    else loadRoster();
  }, [activeTab, load, loadRoster]);

  const filtered = vehicles.filter(v =>
    !search ||
    v.plate_number.toLowerCase().includes(search.toLowerCase()) ||
    v.make?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase()) ||
    v.trailer_number?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (v: Vehicle) => {
    const { id, created_at, ...rest } = v;
    setForm(rest); setEditId(id); setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    if (editId) {
      await supabase.from('vehicles').update(form).eq('id', editId);
    } else {
      await supabase.from('vehicles').insert(form);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('vehicles').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const update = <K extends keyof VehicleInsert>(key: K, value: VehicleInsert[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Fleet" subtitle="Manage your vehicle fleet and trailer assignments" icon={<Truck className="h-6 w-6" />} onAdd={openAdd} addLabel="Add Vehicle" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'fleet' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Vehicles
        </button>
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roster' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Fleet Roster
        </button>
      </div>

      {activeTab === 'fleet' && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search by plate, make, or trailer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <LoadingSpinner message="Loading vehicles..." />
          ) : filtered.length === 0 ? (
            <div className="card"><EmptyState icon={<Truck className="h-8 w-8" />} title="No vehicles found" message="Add your first vehicle to start managing your fleet." /></div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(v => (
                <div key={v.id} className="card p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Truck className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{v.plate_number}</h3>
                        <p className="text-sm text-slate-500">{v.make} {v.model}{v.year ? ` (${v.year})` : ''}</p>
                      </div>
                    </div>
                    {statusBadge(v.status)}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Trailer</p>
                      <p className="font-medium text-slate-700">{v.trailer_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Capacity</p>
                      <p className="font-medium text-slate-700">{v.capacity_kg ? `${v.capacity_kg} kg` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Odometer</p>
                      <p className="font-medium text-slate-700">{v.current_odometer ? `${v.current_odometer.toLocaleString()} km` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Last Service</p>
                      <p className="font-medium text-slate-700">{v.last_service_date || '—'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-1">
                    <button onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteId(v.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'roster' && (
        <>
          <p className="text-sm text-slate-500">
            The Fleet Roster links each truck and trailer to its currently assigned driver and that driver's compliance details (KRA, NSSF, SHA).
          </p>
          {rosterLoading ? (
            <LoadingSpinner message="Loading fleet roster..." />
          ) : roster.length === 0 ? (
            <div className="card"><EmptyState icon={<Truck className="h-8 w-8" />} title="No roster data" message="Add vehicles and assign trips to build the fleet roster." /></div>
          ) : (
            <div className="card table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Plate Number</th>
                    <th>Trailer</th>
                    <th>Make / Model</th>
                    <th>Status</th>
                    <th>Assigned Driver</th>
                    <th>Driver Phone</th>
                    <th>KRA PIN</th>
                    <th>NSSF No.</th>
                    <th>SHA No.</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(row => (
                    <tr key={row.vehicle.id}>
                      <td className="font-medium text-slate-800">{row.vehicle.plate_number}</td>
                      <td className="font-mono text-xs text-slate-600">{row.vehicle.trailer_number || '—'}</td>
                      <td>{row.vehicle.make} {row.vehicle.model}</td>
                      <td>{statusBadge(row.vehicle.status)}</td>
                      <td className="font-medium text-slate-700">{row.driver?.name || <span className="text-slate-400">Unassigned</span>}</td>
                      <td>{row.driver?.phone || '—'}</td>
                      <td className="font-mono text-xs text-slate-500">{row.employee?.kra_pin || '—'}</td>
                      <td className="font-mono text-xs text-slate-500">{row.employee?.nssf_number || '—'}</td>
                      <td className="font-mono text-xs text-slate-500">{row.employee?.sha_number || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Vehicle' : 'Add Vehicle'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Plate Number *</label>
            <input className="input" value={form.plate_number} onChange={e => update('plate_number', e.target.value)} placeholder="e.g., KDA 123A" />
          </div>
          <div>
            <label className="label">Trailer Number</label>
            <input className="input" value={form.trailer_number || ''} onChange={e => update('trailer_number', e.target.value || null)} placeholder="e.g., TR-001" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <div>
            <label className="label">Make</label>
            <input className="input" value={form.make || ''} onChange={e => update('make', e.target.value)} placeholder="e.g., Isuzu" />
          </div>
          <div>
            <label className="label">Model</label>
            <input className="input" value={form.model || ''} onChange={e => update('model', e.target.value)} placeholder="e.g., FRR" />
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input" value={form.year ?? ''} onChange={e => update('year', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Capacity (kg)</label>
            <input type="number" className="input" value={form.capacity_kg ?? ''} onChange={e => update('capacity_kg', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Fuel Type</label>
            <select className="input" value={form.fuel_type || 'diesel'} onChange={e => update('fuel_type', e.target.value)}>
              <option value="diesel">Diesel</option>
              <option value="petrol">Petrol</option>
              <option value="electric">Electric</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label className="label">Current Odometer (km)</label>
            <input type="number" className="input" value={form.current_odometer ?? 0} onChange={e => update('current_odometer', e.target.value ? Number(e.target.value) : 0)} />
          </div>
          <div>
            <label className="label">Last Service Date</label>
            <input type="date" className="input" value={form.last_service_date || ''} onChange={e => update('last_service_date', e.target.value || null)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes || ''} onChange={e => update('notes', e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Vehicle' : 'Add Vehicle'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Vehicle" message="Are you sure you want to remove this vehicle from the fleet?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
