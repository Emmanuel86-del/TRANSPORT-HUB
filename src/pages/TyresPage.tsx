import { useEffect, useState, useCallback, useMemo } from 'react';
import { Disc, Plus, Edit, Search, Disc3, Package, TrendingUp, Archive, AlertTriangle } from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Modal } from '@/components/Modal';
import { DocumentUpload } from '@/components/DocumentUpload';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount, MCLArea } from '@/lib/portals';

type TyreStatus = 'in_store' | 'in_use' | 'worn_out' | 'punctured' | 'retired';
type TyreType = 'new' | 'retreaded' | 'second_hand';
type Position = 'FL' | 'FR' | 'RL' | 'RR' | 'RL2' | 'RR2' | 'Spare';

interface Tyre {
  id: string;
  tyre_id: string;
  brand: string | null;
  size: string | null;
  serial_number: string | null;
  type: string | null;
  status: string;
  current_vehicle_id: string | null;
  position: string | null;
  fitted_date: string | null;
  km_at_fitting: number | null;
  removed_date: string | null;
  km_at_removal: number | null;
  km_run: number | null;
  removal_reason: string | null;
  cost: number | null;
  supplier: string | null;
  sub_account: string | null;
  notes: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
  vehicle?: { plate_number: string; make: string | null; model: string | null } | null;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  in_store: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'In Store' },
  in_use: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Use' },
  worn_out: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Worn Out' },
  punctured: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Punctured' },
  retired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Retired' },
};

const POSITIONS: Position[] = ['FL', 'FR', 'RL', 'RR', 'RL2', 'RR2', 'Spare'];
const TYRE_TYPES: { value: TyreType; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'retreaded', label: 'Retreaded' },
  { value: 'second_hand', label: 'Second-hand' },
];
const STATUSES: { value: TyreStatus; label: string }[] = [
  { value: 'in_store', label: 'In Store' },
  { value: 'in_use', label: 'In Use' },
  { value: 'worn_out', label: 'Worn Out' },
  { value: 'punctured', label: 'Punctured' },
  { value: 'retired', label: 'Retired' },
];

const TABS = [
  { id: 'in_use', label: 'Active Tyres', filter: 'in_use' },
  { id: 'in_store', label: 'Store Inventory', filter: 'in_store' },
];

const fmtKES = (n: number | null) => n != null ? n.toLocaleString() : '—';

export function TyresPage({ mclArea, portalColor, isMaster = false }: { mclArea: MCLArea | null; portalColor: string; isMaster?: boolean }) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const subAccount = (profile?.sub_account ?? getSubAccountFilter() ?? 'master') as SubAccount;

  const [loading, setLoading] = useState(true);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tyreDocs, setTyreDocs] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState('in_use');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTruck, setFilterTruck] = useState('');
  const [filterSubAccount, setFilterSubAccount] = useState('');
  const [filterSize, setFilterSize] = useState('');

  const emptyForm = {
    tyre_id: '', brand: '', size: '', serial_number: '', type: 'new' as string,
    status: 'in_store' as string, sub_account: subAccount as string,
    current_vehicle_id: '', position: '', fitted_date: '', km_at_fitting: null as number | null,
    removed_date: '', km_at_removal: null as number | null, removal_reason: '',
    cost: null as number | null, supplier: '', notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('tyres')
      .select('*, vehicle:vehicles(plate_number, make, model)')
      .order('created_at', { ascending: false });
    if (isMaster && filterSubAccount) query = query.eq('sub_account', filterSubAccount);
    const [tyresRes, vehRes] = await Promise.all([
      query,
      supabase.from('vehicles').select('id, plate_number, make, model').order('plate_number'),
    ]);
    setTyres((tyresRes.data as Tyre[]) || []);
    setVehicles(vehRes.data || []);
    setLoading(false);
  }, [isMaster, filterSubAccount]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredTyres = useMemo(() => {
    return tyres.filter(t => {
      if (activeTabId === 'in_use' && t.status !== 'in_use') return false;
      if (activeTabId === 'in_store' && t.status !== 'in_store') return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.tyre_id.toLowerCase().includes(q) && !(t.brand || '').toLowerCase().includes(q) && !(t.serial_number || '').toLowerCase().includes(q)) return false;
      }
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterTruck && t.current_vehicle_id !== filterTruck) return false;
      if (filterSize && t.size !== filterSize) return false;
      return true;
    });
  }, [tyres, activeTabId, search, filterStatus, filterTruck, filterSize]);

  const summary = useMemo(() => ({
    total: tyres.length,
    inUse: tyres.filter(t => t.status === 'in_use').length,
    inStore: tyres.filter(t => t.status === 'in_store').length,
    wornRetired: tyres.filter(t => t.status === 'worn_out' || t.status === 'retired').length,
    costMonth: tyres.filter(t => {
      if (!t.created_at) return false;
      const d = new Date(t.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, t) => s + (t.cost || 0), 0),
  }), [tyres]);

  const sizes = useMemo(() => [...new Set(tyres.map(t => t.size).filter(Boolean))].sort(), [tyres]);

  const computedKmRun = useMemo(() => {
    if (form.km_at_removal != null && form.km_at_fitting != null) return Math.max(0, form.km_at_removal - form.km_at_fitting);
    return null;
  }, [form.km_at_removal, form.km_at_fitting]);

  const openAdd = () => {
    setForm({ ...emptyForm, status: activeTabId === 'in_use' ? 'in_use' : 'in_store' });
    setEditId(null);
    setTyreDocs([]);
    setModalOpen(true);
  };

  const openEdit = (t: Tyre) => {
    setForm({
      tyre_id: t.tyre_id, brand: t.brand || '', size: t.size || '', serial_number: t.serial_number || '',
      type: t.type || 'new', status: t.status, sub_account: t.sub_account || subAccount,
      current_vehicle_id: t.current_vehicle_id || '', position: t.position || '',
      fitted_date: t.fitted_date || '', km_at_fitting: t.km_at_fitting ?? null,
      removed_date: t.removed_date || '', km_at_removal: t.km_at_removal ?? null,
      removal_reason: t.removal_reason || '', cost: t.cost ?? null, supplier: t.supplier || '',
      notes: t.notes || '',
    });
    setEditId(t.id);
    setTyreDocs(t.attachment_url ? [t.attachment_url] : []);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.tyre_id) { showToast('Tyre ID is required', 'error'); return; }
    setSaving(true);
    const payload: any = { ...form };
    if (!payload.current_vehicle_id) payload.current_vehicle_id = null;
    if (!payload.fitted_date) payload.fitted_date = null;
    if (!payload.removed_date) payload.removed_date = null;
    if (!payload.position) payload.position = null;
    payload.km_run = computedKmRun ?? 0;
    payload.attachment_url = tyreDocs[0] || null;
    payload.attachment_name = tyreDocs[0] ? tyreDocs[0].split('/').pop() : null;

    if (editId) {
      const { error } = await supabase.from('tyres').update(payload).eq('id', editId);
      if (error) showToast('Failed to save: ' + error.message, 'error');
      else showToast('Tyre updated', 'success');
    } else {
      const { error } = await supabase.from('tyres').insert(payload);
      if (error) {
        showToast(error.code === '23505' ? 'Tyre ID already exists' : 'Failed to create: ' + error.message, 'error');
        setSaving(false);
        return;
      }
      showToast('Tyre created', 'success');
    }
    setSaving(false);
    setModalOpen(false);
    loadData();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Tyres" subtitle="Track tyre inventory, usage, and lifecycle across the fleet" icon={<Disc className="h-6 w-6" />} iconColor={portalColor} onAdd={openAdd} addLabel="Add Tyre" />

      {isMaster && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">Sub-Account:</label>
          <select className="input w-48 text-sm py-1.5" value={filterSubAccount} onChange={e => setFilterSubAccount(e.target.value)}>
            <option value="">All Sub-Accounts</option>
            <option value="mcl">MCL</option>
            <option value="tarmal">TARMAL</option>
            <option value="csl">CSL</option>
            <option value="mushroom">MUSHROOM</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Tyres" value={String(summary.total)} icon={<Disc3 className="h-6 w-6" />} color="blue" />
        <StatCard label="In Use" value={String(summary.inUse)} icon={<TrendingUp className="h-6 w-6" />} color="emerald" />
        <StatCard label="In Store" value={String(summary.inStore)} icon={<Archive className="h-6 w-6" />} color="slate" />
        <StatCard label="Worn Out / Retired" value={String(summary.wornRetired)} icon={<AlertTriangle className="h-6 w-6" />} color="amber" />
        <StatCard label="Cost This Month" value={`KES ${fmtKES(summary.costMonth)}`} icon={<Package className="h-6 w-6" />} color="rose" />
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTabId(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTabId === tab.id ? 'text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
            style={activeTabId === tab.id ? { background: portalColor } : undefined}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9 text-sm" placeholder="Search Tyre ID, Brand, Serial..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto text-sm py-1.5" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="input w-auto text-sm py-1.5" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
          <option value="">All Sizes</option>
          {sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto text-sm py-1.5" value={filterTruck} onChange={e => setFilterTruck(e.target.value)}>
          <option value="">All Trucks</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
        </select>
        {(search || filterStatus || filterTruck || filterSize) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterTruck(''); setFilterSize(''); }}
            className="text-xs hover:underline font-medium whitespace-nowrap" style={{ color: portalColor }}>
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading tyres..." />
      ) : filteredTyres.length === 0 ? (
        <div className="card"><EmptyState icon={<Disc className="h-8 w-8" />} title="No tyres found" message="Add a tyre or adjust your filters." /></div>
      ) : (
        <div className="card table-wrapper overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tyre ID</th>
                <th>Brand</th>
                <th>Size</th>
                <th>Serial No</th>
                <th>Type</th>
                <th>Status</th>
                <th>Current Truck</th>
                <th>Position</th>
                <th>Fitted Date</th>
                <th>KM Run</th>
                <th>Cost</th>
                {isMaster && <th>Sub-Account</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredTyres.map(t => {
                const badge = STATUS_BADGES[t.status] || STATUS_BADGES.in_store;
                const typeLabel = TYRE_TYPES.find(tt => tt.value === t.type)?.label || t.type;
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="font-bold text-slate-800">{t.tyre_id}</td>
                    <td className="text-slate-700">{t.brand || '—'}</td>
                    <td className="text-slate-600">{t.size || '—'}</td>
                    <td className="text-slate-600">{t.serial_number || '—'}</td>
                    <td className="text-slate-600">{typeLabel}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>{badge.label}</span></td>
                    <td className="text-slate-600">{t.vehicle?.plate_number || '—'}</td>
                    <td className="text-slate-600">{t.position || '—'}</td>
                    <td className="text-slate-600">{t.fitted_date || '—'}</td>
                    <td className="text-slate-600">{t.km_run != null ? t.km_run.toLocaleString() : '—'}</td>
                    <td className="text-slate-600">{fmtKES(t.cost)}</td>
                    {isMaster && <td><span className="text-xs font-semibold uppercase text-slate-500">{t.sub_account}</span></td>}
                    <td>
                      <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Tyre' : 'Add Tyre'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Tyre ID *</label>
            <input type="text" className="input" value={form.tyre_id} onChange={e => setForm({ ...form, tyre_id: e.target.value })} placeholder="e.g. TYRE-001" />
          </div>
          <div>
            <label className="label">Brand</label>
            <input type="text" className="input" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Michelin" />
          </div>
          <div>
            <label className="label">Size</label>
            <input type="text" className="input" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="e.g. 11R22.5" />
          </div>
          <div>
            <label className="label">Serial Number</label>
            <input type="text" className="input" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {TYRE_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {isMaster && (
            <div>
              <label className="label">Sub-Account</label>
              <select className="input" value={form.sub_account} onChange={e => setForm({ ...form, sub_account: e.target.value })}>
                <option value="mcl">MCL</option>
                <option value="tarmal">TARMAL</option>
                <option value="csl">CSL</option>
                <option value="mushroom">MUSHROOM</option>
                <option value="master">Master</option>
              </select>
            </div>
          )}
          <div>
            <label className="label">Current Truck</label>
            <select className="input" value={form.current_vehicle_id} onChange={e => setForm({ ...form, current_vehicle_id: e.target.value })}>
              <option value="">None / In Store</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} ({v.make} {v.model})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Position</label>
            <select className="input" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}>
              <option value="">—</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fitted Date</label>
            <input type="date" className="input" value={form.fitted_date} onChange={e => setForm({ ...form, fitted_date: e.target.value })} />
          </div>
          <div>
            <label className="label">KM at Fitting</label>
            <input type="number" step="1" className="input" value={form.km_at_fitting ?? ''} onChange={e => setForm({ ...form, km_at_fitting: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Removed Date</label>
            <input type="date" className="input" value={form.removed_date} onChange={e => setForm({ ...form, removed_date: e.target.value })} />
          </div>
          <div>
            <label className="label">KM at Removal</label>
            <input type="number" step="1" className="input" value={form.km_at_removal ?? ''} onChange={e => setForm({ ...form, km_at_removal: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">KM Run (auto)</label>
            <input type="text" className="input bg-slate-50" readOnly value={computedKmRun != null ? computedKmRun.toLocaleString() : '—'} />
          </div>
          <div>
            <label className="label">Removal Reason</label>
            <input type="text" className="input" value={form.removal_reason} onChange={e => setForm({ ...form, removal_reason: e.target.value })} />
          </div>
          <div>
            <label className="label">Cost (KES)</label>
            <input type="number" step="0.01" className="input" value={form.cost ?? ''} onChange={e => setForm({ ...form, cost: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Supplier</label>
            <input type="text" className="input" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DocumentUpload folder="tyres" recordId={editId || 'unsaved'} existingDocs={tyreDocs} onDocsChange={setTyreDocs} />

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || !form.tyre_id} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Tyre' : 'Save Tyre'}</button>
        </div>
      </Modal>
    </div>
  );
}
