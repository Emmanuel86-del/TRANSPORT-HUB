import { useEffect, useState, useCallback } from 'react';
import { Route, Search, Trash2, Edit, Upload, ExternalLink, FileSpreadsheet, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Trip, TripInsert } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

const emptyForm: TripInsert & { attachment_url?: string | null; attachment_name?: string | null } = {
  date: new Date().toISOString().slice(0, 10),
  trip_number: '',
  lorry_no: '',
  driver_name: '',
  route: '',
  cargo: '',
  tonnage: null,
  status: 'planned',
  notes: '',
  attachment_url: null,
  attachment_name: null,
};

function downloadTemplate() {
  const headers = ['date', 'trip_number', 'lorry_no', 'driver_name', 'route', 'cargo', 'tonnage', 'status', 'notes'];
  const sampleRow = ['2026-09-29', 'TR-001', 'KDA 123A', 'John Doe', 'Nairobi - Mombasa', 'General Cargo', '28', 'planned', 'Sample trip'];
  const csv = [headers, sampleRow].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trips_bulk_template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function Trips() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('trips').select('*').order('date', { ascending: false });
    setTrips(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = trips.filter(t => {
    const matchSearch = !search ||
      t.trip_number.toLowerCase().includes(search.toLowerCase()) ||
      t.lorry_no?.toLowerCase().includes(search.toLowerCase()) ||
      t.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.route?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (t: any) => { const { id, created_at, ...rest } = t; setForm(rest); setEditId(id); setModalOpen(true); };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `trip_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('documents').upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      setForm(prev => ({ ...prev, attachment_url: urlData.publicUrl, attachment_name: file.name }));
    }
    setUploading(false);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkUploading(true);
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { alert('File is empty.'); setBulkUploading(false); return; }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i] || null; });
      return {
        date: obj.date || new Date().toISOString().slice(0, 10),
        trip_number: obj.trip_number || 'TR-000',
        lorry_no: obj.lorry_no || '',
        driver_name: obj.driver_name || '',
        route: obj.route || '',
        cargo: obj.cargo || '',
        tonnage: obj.tonnage ? Number(obj.tonnage) : null,
        status: obj.status || 'planned',
        notes: obj.notes || '',
      };
    });

    const { error } = await supabase.from('trips').insert(rows);
    setBulkUploading(false);
    if (error) alert('Error: ' + error.message);
    else { setBulkModalOpen(false); load(); }
  };

  const save = async () => {
    setSaving(true);
    if (editId) await supabase.from('trips').update(form).eq('id', editId);
    else await supabase.from('trips').insert(form);
    setSaving(false); setModalOpen(false); load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('trips').delete().eq('id', deleteId);
    setDeleteId(null); load();
  };

  const update = <K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Trips Management" subtitle="Manage dispatch logs, routes, and transit status" icon={<Route className="h-6 w-6" />} onAdd={openAdd} addLabel="Add Trip" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search trips..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkModalOpen(true)} className="btn btn-secondary">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Bulk Excel Upload
          </button>
          <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="planned">Planned</option>
            <option value="in_transit">In Transit</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? <LoadingSpinner message="Loading trips..." /> : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Route className="h-8 w-8" />} title="No trips found" message="Add transit trips to begin tracking logistics." /></div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Trip No.</th><th>Lorry</th><th>Driver</th><th>Route</th><th>Cargo</th><th>Tonnage</th><th>Doc</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((t: any) => (
                <tr key={t.id}>
                  <td className="font-medium text-slate-800">{t.date}</td>
                  <td className="font-mono text-xs">{t.trip_number}</td>
                  <td>{t.lorry_no || '—'}</td>
                  <td>{t.driver_name || '—'}</td>
                  <td>{t.route || '—'}</td>
                  <td>{t.cargo || '—'}</td>
                  <td>{t.tonnage ?? '—'}</td>
                  <td>
                    {t.attachment_url ? (
                      <a href={t.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium">
                        <ExternalLink className="h-3.5 w-3.5" /> View
                      </a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td><span className={`badge-${t.status === 'completed' ? 'success' : t.status === 'in_transit' ? 'warning' : 'neutral'}`}>{t.status}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteId(t.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Upload Modal */}
      <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Upload Trips via Excel/CSV" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Download the required template, fill in your trip details, and upload the completed CSV file below.</p>
          <button onClick={downloadTemplate} className="btn btn-secondary w-full flex items-center justify-center gap-2">
            <Download className="h-4 w-4 text-blue-600" /> Download Trips Template
          </button>
          <label className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500">
            <FileSpreadsheet className="h-8 w-8 text-emerald-600 mb-2" />
            <span className="text-sm font-medium text-slate-700">{bulkUploading ? 'Importing...' : 'Click to select filled CSV file'}</span>
            <input type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} disabled={bulkUploading} />
          </label>
        </div>
        <div className="mt-5 flex justify-end"><button onClick={() => setBulkModalOpen(false)} className="btn-secondary">Close</button></div>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Trip' : 'Add Trip'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label">Date *</label><input type="date" className="input" value={form.date} onChange={e => update('date', e.target.value)} /></div>
          <div><label className="label">Trip Number *</label><input className="input" value={form.trip_number} onChange={e => update('trip_number', e.target.value)} /></div>
          <div><label className="label">Lorry No.</label><input className="input" value={form.lorry_no || ''} onChange={e => update('lorry_no', e.target.value)} /></div>
          <div><label className="label">Driver Name</label><input className="input" value={form.driver_name || ''} onChange={e => update('driver_name', e.target.value)} /></div>
          <div><label className="label">Route</label><input className="input" value={form.route || ''} onChange={e => update('route', e.target.value)} /></div>
          <div><label className="label">Cargo</label><input className="input" value={form.cargo || ''} onChange={e => update('cargo', e.target.value)} /></div>
          <div><label className="label">Tonnage</label><input type="number" className="input" value={form.tonnage ?? ''} onChange={e => update('tonnage', e.target.value ? Number(e.target.value) : null)} /></div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => update('status', e.target.value as any)}>
              <option value="planned">Planned</option><option value="in_transit">In Transit</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Upload Document</label>
            <div className="flex items-center gap-2">
              <label className="btn btn-secondary cursor-pointer">
                <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Choose File'}
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
              {form.attachment_url && <a href={form.attachment_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 flex items-center gap-1"><ExternalLink className="h-4 w-4" /> View</a>}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Trip" message="Are you sure?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
