import { useEffect, useState, useCallback } from 'react';
import { Wrench, Search, Trash2, Edit, AlertTriangle, Upload, ExternalLink } from 'lucide-react';
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
  minimum_stock: 0,
  unit_cost: null,
  supplier: '',
  vehicle_compatibility: '',
  last_restocked: null,
  notes: '',
  attachment_url: null,
  attachment_name: null,
};

export function SpareParts() {
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('spare_parts').select('*').order('created_at', { ascending: false });
    setParts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = parts.filter((p: any) => {
    const matchSearch = !search ||
      p.part_name.toLowerCase().includes(search.toLowerCase()) ||
      p.part_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier?.toLowerCase().includes(search.toLowerCase());
    const matchLow = !showLowOnly || p.quantity_in_stock <= p.minimum_stock;
    return matchSearch && matchLow;
  });

  const lowCount = parts.filter(p => p.quantity_in_stock <= p.minimum_stock).length;
  const totalValue = parts.reduce((sum, p) => sum + (p.quantity_in_stock * (p.unit_cost || 0)), 0);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (p: SparePart & { attachment_url?: string | null; attachment_name?: string | null }) => {
    const { id, created_at, ...rest } = p;
    setForm(rest); setEditId(id); setModalOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `sparepart_${Date.now()}.${ext}`;
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
      await supabase.from('spare_parts').update(form).eq('id', editId);
    } else {
      await supabase.from('spare_parts').insert(form);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('spare_parts').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const update = <K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const stockBadge = (part: SparePart) => {
    if (part.quantity_in_stock === 0) return <span className="badge-danger">Out of Stock</span>;
    if (part.quantity_in_stock <= part.minimum_stock) return <span className="badge-warning">Low Stock</span>;
    return <span className="badge-success">In Stock</span>;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Spare Parts" subtitle="Inventory from Waingo Auto Garage" icon={<Wrench className="h-6 w-6" />} onAdd={openAdd} addLabel="Add Part" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search by name, number, category..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          {lowCount > 0 && (
            <button onClick={() => setShowLowOnly(!showLowOnly)} className={`btn ${showLowOnly ? 'btn-primary' : 'btn-secondary'}`}>
              <AlertTriangle className="h-4 w-4" /> {lowCount} Low Stock
            </button>
          )}
          <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
            Inventory Value: <span className="text-blue-600">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading spare parts..." />
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Wrench className="h-8 w-8" />} title="No spare parts found" message="Add parts to start tracking your garage inventory." /></div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Part Name</th>
                <th>Part #</th>
                <th>Category</th>
                <th>In Stock</th>
                <th>Min Stock</th>
                <th>Unit Cost</th>
                <th>Supplier</th>
                <th>Doc</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id}>
                  <td className="font-medium text-slate-800">{p.part_name}</td>
                  <td className="font-mono text-xs text-slate-500">{p.part_number || '—'}</td>
                  <td>{p.category || '—'}</td>
                  <td className={`font-semibold ${p.quantity_in_stock <= p.minimum_stock ? 'text-amber-600' : 'text-slate-700'}`}>{p.quantity_in_stock}</td>
                  <td className="text-slate-500">{p.minimum_stock}</td>
                  <td>{p.unit_cost ? `$${p.unit_cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</td>
                  <td>{p.supplier || '—'}</td>
                  <td>
                    {p.attachment_url ? (
                      <a href={p.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium">
                        <ExternalLink className="h-3.5 w-3.5" /> View
                      </a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td>{stockBadge(p)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteId(p.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Spare Part' : 'Add Spare Part'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Part Name *</label><input className="input" value={form.part_name} onChange={e => update('part_name', e.target.value)} placeholder="e.g., Brake Pads" /></div>
          <div><label className="label">Part Number</label><input className="input" value={form.part_number || ''} onChange={e => update('part_number', e.target.value)} /></div>
          <div><label className="label">Category</label><input className="input" value={form.category || ''} onChange={e => update('category', e.target.value)} /></div>
          <div><label className="label">Quantity In Stock</label><input type="number" className="input" value={form.quantity_in_stock} onChange={e => update('quantity_in_stock', e.target.value ? Number(e.target.value) : 0)} /></div>
          <div><label className="label">Minimum Stock</label><input type="number" className="input" value={form.minimum_stock} onChange={e => update('minimum_stock', e.target.value ? Number(e.target.value) : 0)} /></div>
          <div><label className="label">Unit Cost ($)</label><input type="number" className="input" value={form.unit_cost ?? ''} onChange={e => update('unit_cost', e.target.value ? Number(e.target.value) : null)} /></div>
          <div><label className="label">Supplier</label><input className="input" value={form.supplier || ''} onChange={e => update('supplier', e.target.value)} /></div>
          <div><label className="label">Vehicle Compatibility</label><input className="input" value={form.vehicle_compatibility || ''} onChange={e => update('vehicle_compatibility', e.target.value)} /></div>
          <div><label className="label">Last Restocked</label><input type="date" className="input" value={form.last_restocked || ''} onChange={e => update('last_restocked', e.target.value || null)} /></div>
          <div className="sm:col-span-2">
            <label className="label">Upload Supplier Invoice / Receipt</label>
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
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Part' : 'Add Part'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Spare Part" message="Are you sure you want to remove this part from inventory?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
