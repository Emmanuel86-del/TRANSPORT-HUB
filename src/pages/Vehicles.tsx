import { useEffect, useState, useCallback } from 'react';
import { Truck, Search, Trash2, Edit, Upload, ExternalLink, FileSpreadsheet, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

interface Vehicle {
  id: string;
  plate_number: string;
  make?: string;
  model?: string;
  year?: number | null;
  capacity_kg?: number | null;
  fuel_type?: string;
  status: string;
  current_odometer?: number | null;
  last_service_date?: string;
  notes?: string;
  trailer_number?: string;
  documents?: string | null;
}

const emptyForm = {
  plate_number: '',
  make: '',
  model: '',
  year: null as number | null,
  capacity_kg: null as number | null,
  fuel_type: 'Diesel',
  status: 'active',
  current_odometer: null as number | null,
  last_service_date: '',
  notes: '',
  trailer_number: '',
  documents: null as string | null,
};

function downloadTemplate() {
  const headers = ['plate_number', 'make', 'model', 'year', 'capacity_kg', 'fuel_type', 'status', 'current_odometer', 'last_service_date', 'notes', 'trailer_number'];
  const sampleRow = ['KCA 123A', 'Scania', 'R450', '2022', '30000', 'Diesel', 'active', '150000', '2026-01-10', 'Main fleet', 'TZ 4567'];
  const csv = [headers, sampleRow].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vehicles_bulk_template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function Vehicles() {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
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
    const { data } = await supabase.from('vehicles').select('*').order('plate_number', { ascending: true });
    setVehicles(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = vehicles.filter(v =>
    !search || v.plate_number.toLowerCase().includes(search.toLowerCase()) || v.make?.toLowerCase().includes(search.toLowerCase()) || v.model?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (v: any) => { const { id, created_at, ...rest } = v; setForm(rest); setEditId(id); setModalOpen(true); };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `vehicle_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('documents').upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      setForm(prev => ({ ...prev, documents: urlData.publicUrl }));
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
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"\vert{}"$/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i] || null; });
      return {
        plate_number: obj.plate_number || 'KAA 000A',
        make: obj.make || '',
        model: obj.model || '',
        year: obj.year ? Number(obj.year) : null,
        capacity_kg: obj.capacity_kg ? Number(obj.capacity_kg) : null,
        fuel_type: obj.fuel_type || 'Diesel',
        status: obj.status || 'active',
        current_odometer: obj.current_odometer ? Number(obj.current_odometer) : null,
        last_service_date: obj.last_service_date || null,
        notes: obj.notes || '',
        trailer_number: obj.trailer_number || '',
      };
    });

    const { error } = await supabase.from('vehicles').insert(rows);
    setBulkUploading(false);
    if (error) alert('Error: ' + error.message);
    else { setBulkModalOpen(false); load(); }
  };

  const save = async () => {
    setSaving(true);
    if (editId) await supabase.from('vehicles').update(form).eq('id', editId);
    else await supabase.from('vehicles').insert(form);
    setSaving(false); setModalOpen(false); load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('vehicles').delete().eq('id', deleteId);
    setDeleteId(null); load();
  };

  const update = <K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Vehicle Management" subtitle="Vehicle inventory, insurance, and inspection tracking" icon={<Truck className="h-6 w-6" />} onAdd={openAdd} addLabel="Add Vehicle" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search plate, make, or model..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setBulkModalOpen(true)} className="btn btn-secondary self-start sm:self-auto">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Bulk Excel Upload
        </button>
      </div>

      {loading ? <LoadingSpinner message="Loading vehicles..." /> : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Truck className="h-8 w-8" />} title="No vehicles found" message="Add vehicles to manage your fleet register." /></div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Plate No.</th><th>Make & Model</th><th>Year</th><th>Capacity (kg)</th><th>Fuel</th><th>Odometer</th><th>Status</th><th>Doc</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((v: any) => (
                <tr key={v.id}>
                  <td className="font-semibold text-slate-800">{v.plate_number}</td>
                  <td>{v.make} {v.model || ''}</td>
                  <td>{v.year || '—'}</td>
                  <td>{v.capacity_kg ? Number(v.capacity_kg).toLocaleString() : '—'}</td>
                  <td>{v.fuel_type || '—'}</td>
                  <td className="font-mono text-xs">{v.current_odometer ? Number(v.current_odometer).toLocaleString() + ' km' : '—'}</td>
                  <td><span className={`badge-${v.status === 'active' ? 'success' : 'neutral'}`}>{v.status}</span></td>
                  <td>
                    {v.documents ? (
                      <a href={v.documents} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium">
                        <ExternalLink className="h-3.5 w-3.5" /> View
                      </a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteId(v.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Upload Modal */}
      <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Upload Vehicles via Excel/CSV" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Download the required template, fill in your vehicle records, and upload the completed CSV file.</p>
          <button onClick={downloadTemplate} className="btn btn-secondary w-full flex items-center justify-center gap-2">
            <Download className="h-4 w-4 text-blue-600" /> Download Vehicles Template
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Vehicle' : 'Add Vehicle'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label">Plate Number *</label><input className="input" value={form.plate_number} onChange={e => update('plate_number', e.target.value)} placeholder="e.g. KCA 123A" /></div>
          <div><label className="label">Make</label><input className="input" value={form.make} onChange={e => update('make', e.target.value)} placeholder="e.g. Scania" /></div>
          <div><label className="label">Model</label><input className="input" value={form.model} onChange={e => update('model', e.target.value)} placeholder="e.g. R450" /></div>
          <div><label className="label">Year</label><input type="number" className="input" value={form.year ?? ''} onChange={e => update('year', e.target.value ? Number(e.target.value) : null)} /></div>
          <div><label className="label">Capacity (kg)</label><input type="number" className="input" value={form.capacity_kg ?? ''} onChange={e => update('capacity_kg', e.target.value ? Number(e.target.value) : null)} /></div>
          <div><label className="label">Fuel Type</label><input className="input" value={form.fuel_type} onChange={e => update('fuel_type', e.target.value)} /></div>
          <div><label className="label">Current Odometer</label><input type="number" className="input" value={form.current_odometer ?? ''} onChange={e => update('current_odometer', e.target.value ? Number(e.target.value) : null)} /></div>
          <div><label className="label">Last Service Date</label><input type="date" className="input" value={form.last_service_date} onChange={e => update('last_service_date', e.target.value)} /></div>
          <div><label className="label">Trailer Number</label><input className="input" value={form.trailer_number} onChange={e => update('trailer_number', e.target.value)} /></div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => update('status', e.target.value as any)}>
              <option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Upload Document</label>
            <div className="flex items-center gap-2">
              <label className="btn btn-secondary cursor-pointer">
                <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Choose File'}
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
              {form.documents && <a href={form.documents} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 flex items-center gap-1"><ExternalLink className="h-4 w-4" /> View</a>}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Vehicle" message="Are you sure?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
