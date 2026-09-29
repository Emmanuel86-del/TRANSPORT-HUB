import { useEffect, useState, useCallback } from 'react';
import { Wrench, Search, Trash2, Edit, Upload, ExternalLink, FileSpreadsheet, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SparePart, SparePartInsert } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

const emptyForm: SparePartInsert & { attachment_url?: string | null; attachment_name?: string | null } = {
  part_name: '',
  part_number: '',
  category: '',
  quantity_in_stock: 0,
  unit_cost: 0,
  supplier: '',
  notes: '',
  attachment_url: null,
  attachment_name: null,
};

function downloadTemplate() {
  const headers = ['part_name', 'part_number', 'category', 'quantity_in_stock', 'unit_cost', 'supplier', 'notes'];
  const sampleRow = ['Brake Pad', 'BP-992', 'Brakes', '15', '4500', 'AutoSpares Ltd', 'Sample part'];
  const csv = [headers, sampleRow].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `spare_parts_bulk_template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function SpareParts() {
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [search, setSearch] = useState('');
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
    const { data } = await supabase.from('spare_parts').select('*').order('part_name', { ascending: true });
    setParts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = parts.filter(p => !search || p.part_name.toLowerCase().includes(search.toLowerCase()) || p.part_number?.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (p: any) => { const { id, created_at, ...rest } = p; setForm(rest); setEditId(id); setModalOpen(true); };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `part_${Date.now()}.${ext}`;
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
        part_name: obj.part_name || 'Unnamed Part',
        part_number: obj.part_number || '',
        category: obj.category || '',
        quantity_in_stock: Number(obj.quantity_in_stock) || 0,
        unit_cost: Number(obj.unit_cost) || 0,
        supplier: obj.supplier || '',
        notes: obj.notes || '',
      };
    });

    const { error } = await supabase.from('spare_parts').insert(rows);
    setBulkUploading(false);
    if (error) alert('Error: ' + error.message);
    else { setBulkModalOpen(false); load(); }
  };

  const save = async () => {
    setSaving(true);
    if (editId) await supabase.from('spare_parts').update(form).eq('id', editId);
    else await supabase.from('spare_parts').insert(form);
    setSaving(false); setModalOpen(false); load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('spare_parts').delete().eq('id', deleteId);
    setDeleteId(null); load();
  };

  const update = <K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Spare Parts Inventory" subtitle="Stock levels, unit costs, and spare parts catalog" icon={<Wrench className="h-6 w-6" />} onAdd={openAdd} addLabel="Add Part" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search parts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setBulkModalOpen(true)} className="btn btn-secondary self-start sm:self-auto">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Bulk Excel Upload
        </button>
      </div>

      {loading ? <LoadingSpinner message="Loading spare parts..." /> : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Wrench className="h-8 w-8" />} title="No spare parts found" message="Add inventory parts to manage stock levels." /></div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Part Name</th><th>Part Number</th><th>Category</th><th>Stock</th><th>Unit Cost</th><th>Supplier</th><th>Doc</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id}>
                  <td className="font-semibold text-slate-800">{p.part_name}</td>
                  <td className="font-mono text-xs">{p.part_number || '—'}</td>
                  <td>{p.category || '—'}</td>
                  <td>{p.quantity_in_stock}</td>
                  <td>{p.unit_cost?.toLocaleString() || '—'}</td>
                  <td>{p.supplier || '—'}</td>
                  <td>
                    {p.attachment_url ? (
                      <a href={p.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium">
                        <ExternalLink className="h-3.5 w-3.5" /> View
                      </a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteId(p.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Upload Modal */}
      <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Upload Spare Parts via Excel/CSV" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Download the required template, fill in your parts stock, and upload the completed CSV file.</p>
          <button onClick={downloadTemplate} className="btn btn-secondary w-full flex items-center justify-center gap-2">
            <Download className="h-4 w-4 text-blue-600" /> Download Template
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Spare Part' : 'Add Spare Part'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label">Part Name *</label><input className="input" value={form.part_name} onChange={e => update('part_name', e.target.value)} /></div>
          <div><label className="label">Part Number</label><input className="input" value={form.part_number || ''} onChange={e => update('part_number', e.target.value)} /></div>
          <div><label className="label">Category</label><input className="input" value={form.category || ''} onChange={e => update('category', e.target.value)} /></div>
          <div><label className="label">Stock Quantity</label><input type="number" className="input" value={form.quantity_in_stock} onChange={e => update('quantity_in_stock', Number(e.target.value))} /></div>
          <div><label className="label">Unit Cost</label><input type="number" className="input" value={form.unit_cost} onChange={e => update('unit_cost', Number(e.target.value))} /></div>
          <div><label className="label">Supplier</label><input className="input" value={form.supplier || ''} onChange={e => update('supplier', e.target.value)} /></div>
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

      <ConfirmDialog open={!!deleteId} title="Delete Part" message="Are you sure?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
