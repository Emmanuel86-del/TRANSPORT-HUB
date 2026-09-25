import { useEffect, useState, useCallback } from 'react';
import { UserCog, Search, Trash2, Edit, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Employee, EmployeeInsert } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

const emptyForm: EmployeeInsert = {
  name: '',
  designation: '',
  kra_pin: '',
  nssf_number: '',
  sha_number: '',
  national_id: '',
  phone_number: '',
  status: 'active',
  notes: '',
};

function exportCSV(employees: Employee[]) {
  const headers = ['Name', 'Designation', 'KRA PIN', 'NSSF Number', 'SHA Number', 'National ID', 'Phone', 'Status'];
  const rows = employees.map(e => [
    e.name,
    e.designation || '',
    e.kra_pin || '',
    e.nssf_number || '',
    e.sha_number || '',
    e.national_id || '',
    e.phone_number || '',
    e.status,
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `staff_register_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function Staff() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeInsert>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
    setEmployees(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.designation?.toLowerCase().includes(search.toLowerCase()) ||
      e.kra_pin?.toLowerCase().includes(search.toLowerCase()) ||
      e.national_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (e: Employee) => {
    const { id, created_at, ...rest } = e;
    setForm(rest); setEditId(id); setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    if (editId) {
      await supabase.from('employees').update(form).eq('id', editId);
    } else {
      await supabase.from('employees').insert(form);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('employees').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const update = <K extends keyof EmployeeInsert>(key: K, value: EmployeeInsert[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="badge-success">Active</span>;
      case 'inactive': return <span className="badge-neutral">Inactive</span>;
      case 'on_leave': return <span className="badge-warning">On Leave</span>;
      default: return <span className="badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Staff Register" subtitle="All organizational staff and compliance records" icon={<UserCog className="h-6 w-6" />} onAdd={openAdd} addLabel="Add Staff" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search by name, designation, KRA, ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
            className="btn btn-secondary"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading staff..." />
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<UserCog className="h-8 w-8" />} title="No staff found" message="Add staff members to maintain your organizational register." /></div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>KRA PIN</th>
                <th>NSSF No.</th>
                <th>SHA No.</th>
                <th>National ID</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td className="font-medium text-slate-800">{e.name}</td>
                  <td>{e.designation || '—'}</td>
                  <td className="font-mono text-xs text-slate-500">{e.kra_pin || '—'}</td>
                  <td className="font-mono text-xs text-slate-500">{e.nssf_number || '—'}</td>
                  <td className="font-mono text-xs text-slate-500">{e.sha_number || '—'}</td>
                  <td className="font-mono text-xs text-slate-500">{e.national_id || '—'}</td>
                  <td>{e.phone_number || '—'}</td>
                  <td>{statusBadge(e.status)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(e.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Staff Member' : 'Add Staff Member'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g., John Waingo" />
          </div>
          <div>
            <label className="label">Designation</label>
            <input className="input" value={form.designation || ''} onChange={e => update('designation', e.target.value)} placeholder="e.g., Operations Manager" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="label">KRA PIN</label>
            <input className="input" value={form.kra_pin || ''} onChange={e => update('kra_pin', e.target.value)} placeholder="e.g., A0512345678X" />
          </div>
          <div>
            <label className="label">NSSF Number</label>
            <input className="input" value={form.nssf_number || ''} onChange={e => update('nssf_number', e.target.value)} placeholder="e.g., NSSF-001234" />
          </div>
          <div>
            <label className="label">SHA Number</label>
            <input className="input" value={form.sha_number || ''} onChange={e => update('sha_number', e.target.value)} placeholder="e.g., SHA-100001" />
          </div>
          <div>
            <label className="label">National ID</label>
            <input className="input" value={form.national_id || ''} onChange={e => update('national_id', e.target.value)} placeholder="e.g., 30156789" />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" value={form.phone_number || ''} onChange={e => update('phone_number', e.target.value)} placeholder="e.g., +254700111222" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes || ''} onChange={e => update('notes', e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Staff' : 'Add Staff'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Staff Member" message="Are you sure you want to remove this staff member from the register?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
