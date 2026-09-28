import { useEffect, useState, useCallback } from 'react';
import { Wallet, Search, Trash2, Edit, Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PayrollRecord, PayrollRecordInsert, Employee } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

const statusBadge = (status: string) => {
  switch (status) {
    case 'paid': return <span className="badge-success">Paid</span>;
    case 'processed': return <span className="badge-info">Processed</span>;
    case 'pending': return <span className="badge-warning">Pending</span>;
    default: return <span className="badge-neutral">{status}</span>;
  }
};

const emptyForm: PayrollRecordInsert = {
  employee_id: null,
  payee_name: '',
  pay_period_start: '',
  pay_period_end: '',
  pay_date: new Date().toISOString().slice(0, 10),
  gross_salary: 0,
  deductions: 0,
  net_salary: 0,
  payment_method: 'bank_transfer',
  status: 'pending',
  notes: '',
};

export function Payroll() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PayrollRecordInsert>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [payrollRes, empRes] = await Promise.all([
      supabase.from('payroll_records').select('*, employee:employees(*)').order('pay_date', { ascending: false }),
      supabase.from('employees').select('*').order('name'),
    ]);
    setRecords(payrollRes.data || []);
    setEmployees(empRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.payee_name.toLowerCase().includes(search.toLowerCase()) ||
      r.notes?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalGross = filtered.reduce((s, r) => s + (r.gross_salary || 0), 0);
  const totalDeductions = filtered.reduce((s, r) => s + (r.deductions || 0), 0);
  const totalNet = filtered.reduce((s, r) => s + (r.net_salary || 0), 0);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (r: PayrollRecord) => {
    const { id, created_at, employee, ...rest } = r;
    setForm(rest); setEditId(id); setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const data = { ...form, employee_id: form.employee_id || null };
    if (editId) {
      await supabase.from('payroll_records').update(data).eq('id', editId);
    } else {
      await supabase.from('payroll_records').insert(data);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('payroll_records').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const update = <K extends keyof PayrollRecordInsert>(key: K, value: PayrollRecordInsert[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleEmployeeSelect = (empId: string | null) => {
    update('employee_id', empId);
    if (empId) {
      const emp = employees.find(e => e.id === empId);
      if (emp) update('payee_name', emp.name);
    }
  };

  const calcNet = () => {
    const net = (form.gross_salary || 0) - (form.deductions || 0);
    update('net_salary', net);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Payroll" subtitle="Salary and payment records" icon={<Wallet className="h-6 w-6" />} onAdd={openAdd} addLabel="Add Record" />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-slate-400">Total Gross</p>
          <p className="text-lg font-bold text-slate-700 mt-1">{totalGross.toLocaleString()} KES</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">Total Deductions</p>
          <p className="text-lg font-bold text-amber-600 mt-1">{totalDeductions.toLocaleString()} KES</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">Total Net</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{totalNet.toLocaleString()} KES</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search by payee name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="processed">Processed</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading payroll..." />
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Wallet className="h-8 w-8" />} title="No payroll records" message="Add your first payroll record to start tracking salary payments." /></div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pay Date</th>
                <th>Payee</th>
                <th>Pay Period</th>
                <th>Gross (KES)</th>
                <th>Deductions</th>
                <th>Net (KES)</th>
                <th>Method</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-800 whitespace-nowrap">{r.pay_date}</td>
                  <td className="text-slate-700">{r.payee_name}</td>
                  <td className="text-slate-500 text-sm whitespace-nowrap">{r.pay_period_start || '—'} → {r.pay_period_end || '—'}</td>
                  <td className="font-semibold text-slate-700">{r.gross_salary.toLocaleString()}</td>
                  <td className="text-amber-600">{r.deductions.toLocaleString()}</td>
                  <td className="font-semibold text-blue-600">{r.net_salary.toLocaleString()}</td>
                  <td className="text-slate-600 capitalize text-sm">{r.payment_method.replace('_', ' ')}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Payroll Record' : 'Add Payroll Record'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Link to Employee (optional)</label>
            <select className="input" value={form.employee_id || ''} onChange={e => handleEmployeeSelect(e.target.value || null)}>
              <option value="">Not linked</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.designation || 'Staff'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payee Name *</label>
            <input className="input" value={form.payee_name} onChange={e => update('payee_name', e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className="label">Pay Date *</label>
            <input type="date" className="input" value={form.pay_date} onChange={e => update('pay_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Pay Period Start</label>
            <input type="date" className="input" value={form.pay_period_start || ''} onChange={e => update('pay_period_start', e.target.value)} />
          </div>
          <div>
            <label className="label">Pay Period End</label>
            <input type="date" className="input" value={form.pay_period_end || ''} onChange={e => update('pay_period_end', e.target.value)} />
          </div>
          <div>
            <label className="label">Gross Salary (KES)</label>
            <input type="number" className="input" value={form.gross_salary} onChange={e => update('gross_salary', Number(e.target.value))} onBlur={calcNet} />
          </div>
          <div>
            <label className="label">Deductions (KES)</label>
            <input type="number" className="input" value={form.deductions} onChange={e => update('deductions', Number(e.target.value))} onBlur={calcNet} />
          </div>
          <div>
            <label className="label">Net Salary (KES)</label>
            <div className="flex items-center gap-2">
              <input type="number" className="input bg-slate-50" value={form.net_salary} onChange={e => update('net_salary', Number(e.target.value))} />
              <button type="button" onClick={calcNet} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors shrink-0">
                <Calculator className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="input" value={form.payment_method} onChange={e => update('payment_method', e.target.value)}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mpesa">M-Pesa</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes || ''} onChange={e => update('notes', e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || !form.payee_name} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Record' : 'Add Record'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Payroll Record" message="Are you sure you want to delete this payroll record?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
