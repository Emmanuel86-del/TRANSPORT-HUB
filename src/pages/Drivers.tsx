import { useEffect, useState, useCallback } from 'react';
import { Users, Search, Trash2, Edit, Phone, Upload, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Driver, DriverInsert } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

const statusBadge = (status: string) => {
  switch (status) {
    case 'active': return <span className="badge-success">Active</span>;
    case 'on_leave': return <span className="badge-warning">On Leave</span>;
    case 'inactive': return <span className="badge-neutral">Inactive</span>;
    default: return <span className="badge-neutral">{status}</span>;
  }
};

const emptyForm: DriverInsert & { attachment_url?: string | null; attachment_name?: string | null } = {
  name: '',
  phone: '',
  license_number: '',
  license_expiry: null,
  status: 'active',
  hire_date: null,
  notes: '',
  attachment_url: null,
  attachment_name: null,
};

export function Drivers() {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
    setDrivers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = drivers.filter((d: any) =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.phone?.toLowerCase().includes(search.toLowerCase()) ||
    d.license_number?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (d: Driver & { attachment_url?: string | null; attachment_name?: string | null }) => {
    const { id, created_at, ...rest } = d;
    setForm(rest); setEditId(id); setModalOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `driver_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('documents').upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      setForm(prev => ({ ...prev, attachment_url: urlData.publicUrl, attachment_name: file.name }));
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    if (editId) {
      await supabase.from('drivers').update(form).eq('id', editId);
    } else {
      await supabase.from('drivers').insert(form);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('drivers').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const update = <K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Drivers" subtitle="Manage your driver directory" icon={<Users className="h-6 w-6" />} onAdd={openAdd} addLabel="Add Driver" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className="input pl-9" placeholder="Search by name, phone, or license..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <LoadingSpinner message="Loading drivers..." />
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Users className="h-8 w-8" />} title="No drivers found" message="Add your first driver to start building your directory." /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d: any) => (
            <div key={d.id} className="card p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <span className="text-lg font-bold">{d.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{d.name}</h3>
                    {d.phone && (
                      <p className="flex items-center gap-1 text-sm text-slate-500">
                        <Phone className="h-3 w-3" /> {d.phone}
                      </p>
                    )}
                  </div>
                </div>
                {statusBadge(d.status)}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-slate-400">License #</p><p className="font-medium text-slate-700">{d.license_number || '—'}</p></div>
                <div>
                  <p className="text-xs text-slate-400">License Expiry</p>
                  <p className={`font-medium ${d.license_expiry && new Date(d.license_expiry) < new Date() ? 'text-red-600' : 'text-slate-700'}`}>
                    {d.license_expiry || '—'}
                  </p>
                </div>
                <div><p className="text-xs text-slate-400">Hire Date</p><p className="font-medium text-slate-700">{d.hire_date || '—'}</p></div>
                <div>
                  <p className="text-xs text-slate-400">License Doc</p>
                  {d.attachment_url ? (
                    <a href={d.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium mt-0.5">
                      <ExternalLink className="h-3.5 w-3.5" /> View
                    </a>
                  ) : <p className="text-slate-400">—</p>}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-1">
                <button onClick={() => openEdit(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Edit className="h-4 w-4" /></button>
                <button onClick={() => setDeleteId(d.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Driver' : 'Add Driver'}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Full name" /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="e.g., +254 700 000 000" /></div>
          <div><label className="label">License Number</label><input className="input" value={form.license_number || ''} onChange={e => update('license_number', e.target.value)} /></div>
          <div><label className="label">License Expiry</label><input type="date" className="input" value={form.license_expiry || ''} onChange={e => update('license_expiry', e.target.value || null)} /></div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div><label className="label">Hire Date</label><input type="date" className="input" value={form.hire_date || ''} onChange={e => update('hire_date', e.target.value || null)} /></div>
          <div className="sm:col-span-2">
            <label className="label">Upload Driving License / Certificate</label>
            <div className="flex items-center gap-2">
              <label className="btn btn-secondary cursor-pointer">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Choose File'}
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }} />
              </label>
              {form.attachment_url && (
                <a href={form.attachment_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <ExternalLink className="h-4 w-4" /> {form.attachment_name || 'View document'}
                </a>
              )}
            </div>
          </div>
          <div className="sm:col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes || ''} onChange={e => update('notes', e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Driver' : 'Add Driver'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Driver" message="Are you sure you want to remove this driver?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
