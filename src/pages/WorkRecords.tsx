import { useEffect, useState, useCallback } from 'react';
import { Wrench, Search, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { WorkRecord, Vehicle, WorkRecordInsert } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

const statusBadge = (status: string) => {
  switch (status) {
    case 'completed': return <span className="badge-success">Completed</span>;
    case 'in_progress': return <span className="badge-info">In Progress</span>;
    case 'scheduled': return <span className="badge-warning">Scheduled</span>;
    default: return <span className="badge-neutral">{status}</span>;
  }
};

const emptyForm: WorkRecordInsert = {
  work_date: new Date().toISOString().slice(0, 10),
  vehicle_id: null,
  description: '',
  work_type: '',
  hours_worked: null,
  labor_cost: null,
  parts_cost: 0,
  performed_by: '',
  status: 'completed',
  notes: '',
};

export function WorkRecords() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkRecordInsert>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [workRes, vehiclesRes] = await Promise.all([
      supabase.from('work_records').select('*, vehicle:vehicles(*)').order('work_date', { ascending: false }),
      supabase.from('vehicles').select('*'),
    ]);
    setRecords(workRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter(r =>
    !search ||
    r.description.toLowerCase().includes(search.toLowerCase()) ||
    r.work_type?.toLowerCase().includes(search.toLowerCase()) ||
    r.performed_by?.toLowerCase().includes(search.toLowerCase())
  );

  const totalLabor = records.reduce((s, r) => s + (r.labor_cost || 0), 0);
  const totalParts = records.reduce((s, r) => s + (r.parts_cost || 0), 0);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (r: WorkRecord) => {
    const { id, created_at, vehicle, ...rest } = r;
    setForm(rest); setEditId(id); setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const data = { ...form, vehicle_id: form.vehicle_id || null };
    if (editId) {
      await supabase.from('work_records').update(data).eq('id', editId);
    } else {
      await supabase.from('work_records').insert(data);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('work_records').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const update = <K extends keyof WorkRecordInsert>(key: K, value: WorkRecordInsert[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Work Records" subtitle="Maintenance and repair work logs" icon={<Wrench className="h-6 w-6" />} onAdd={openAdd} addLabel="New Record" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search work records..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-slate-600">Labor: <span className="text-rose-600">${totalLabor.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
          <span className="font-medium text-slate-600">Parts: <span className="text-amber-600">${totalParts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading work records..." />
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Wrench className="h-8 w-8" />} title="No work records found" message="Log your first maintenance or repair record." /></div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>Vehicle</th>
                <th>Hours</th>
                <th>Labor Cost</th>
                <th>Parts Cost</th>
                <th>Total</th>
                <th>Performed By</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-800 whitespace-nowrap">{r.work_date}</td>
                  <td className="max-w-xs truncate">{r.description}</td>
                  <td>{r.work_type || '—'}</td>
                  <td>{r.vehicle ? r.vehicle.plate_number : <span className="text-slate-400">—</span>}</td>
                  <td>{r.hours_worked ? `${r.hours_worked}h` : '—'}</td>
                  <td className="text-rose-600">{r.labor_cost ? `$${r.labor_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</td>
                  <td className="text-amber-600">{r.parts_cost ? `$${r.parts_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</td>
                  <td className="font-semibold text-slate-700">${((r.labor_cost || 0) + (r.parts_cost || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td>{r.performed_by || '—'}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(r.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Work Record' : 'New Work Record'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Work Date *</label>
            <input type="date" className="input" value={form.work_date} onChange={e => update('work_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Vehicle</label>
            <select className="input" value={form.vehicle_id || ''} onChange={e => update('vehicle_id', e.target.value || null)}>
              <option value="">No specific vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description *</label>
            <input className="input" value={form.description} onChange={e => update('description', e.target.value)} placeholder="e.g., Oil change and filter replacement" />
          </div>
          <div>
            <label className="label">Work Type</label>
            <select className="input" value={form.work_type || ''} onChange={e => update('work_type', e.target.value)}>
              <option value="">Select type</option>
              <option value="routine">Routine Service</option>
              <option value="repair">Repair</option>
              <option value="inspection">Inspection</option>
              <option value="tire">Tire Service</option>
              <option value="engine">Engine Work</option>
              <option value="electrical">Electrical</option>
              <option value="body">Body Work</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="label">Hours Worked</label>
            <input type="number" className="input" value={form.hours_worked ?? ''} onChange={e => update('hours_worked', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Performed By</label>
            <input className="input" value={form.performed_by || ''} onChange={e => update('performed_by', e.target.value)} placeholder="Mechanic name" />
          </div>
          <div>
            <label className="label">Labor Cost ($)</label>
            <input type="number" className="input" value={form.labor_cost ?? ''} onChange={e => update('labor_cost', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Parts Cost ($)</label>
            <input type="number" className="input" value={form.parts_cost ?? 0} onChange={e => update('parts_cost', e.target.value ? Number(e.target.value) : 0)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes || ''} onChange={e => update('notes', e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Record' : 'Create Record'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Work Record" message="Are you sure you want to delete this work record?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
