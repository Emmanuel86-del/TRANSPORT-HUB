import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Wrench, Plus, Edit, Search, X, History, Package,
  Wrench as WrenchIcon, Battery, Truck as TruckIcon, Clock,
} from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { DocumentUpload } from '@/components/DocumentUpload';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount, MCLArea } from '@/lib/portals';

type Category = 'batteries_critical' | 'general';
type PartType = 'new' | 'rebound';
type PartStatus = 'in_store' | 'in_use' | 'under_repair' | 'retired';
type HistoryAction = 'installed' | 'removed' | 'sent_for_repair' | 'returned_from_repair' | 'retired';

interface SparePart {
  id: string;
  sub_account: string;
  mcl_area_id: string | null;
  serial_number: string;
  part_name: string;
  category: Category;
  part_type: PartType;
  status: PartStatus;
  supplier: string | null;
  purchase_date: string | null;
  unit_cost: number | null;
  current_truck_id: string | null;
  installed_date: string | null;
  notes: string | null;
  documents: string[] | null;
  created_at: string;
  vehicle?: { plate_number: string; make: string | null; model: string | null } | null;
}

interface HistoryEntry {
  id: string;
  spare_part_id: string;
  action: HistoryAction;
  action_date: string;
  vehicle_id: string | null;
  duration_days: number | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
  vehicle?: { plate_number: string } | null;
}

const CATEGORY_TABS: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: 'batteries_critical', label: 'Batteries & Critical Parts', icon: <Battery className="h-4 w-4" /> },
  { id: 'general', label: 'General Spares', icon: <WrenchIcon className="h-4 w-4" /> },
];

const PART_TYPE_TABS: { id: PartType; label: string }[] = [
  { id: 'new', label: 'New Spares' },
  { id: 'rebound', label: 'Rebound Spares' },
];

const STATUS_BADGES: Record<PartStatus, { bg: string; text: string; label: string }> = {
  in_store: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'In Store' },
  in_use: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Use' },
  under_repair: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Under Repair' },
  retired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Retired' },
};

const ACTION_LABELS: Record<HistoryAction, string> = {
  installed: 'Installed',
  removed: 'Removed',
  sent_for_repair: 'Sent for Repair',
  returned_from_repair: 'Returned from Repair',
  retired: 'Retired',
};

const ACTION_COLORS: Record<HistoryAction, string> = {
  installed: 'text-blue-600',
  removed: 'text-slate-600',
  sent_for_repair: 'text-amber-600',
  returned_from_repair: 'text-emerald-600',
  retired: 'text-red-600',
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function SparePartsV2({
  mclArea,
  portalColor,
  isMaster = false,
}: {
  mclArea: MCLArea | null;
  portalColor: string;
  isMaster?: boolean;
}) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const subAccount = (profile?.sub_account ?? getSubAccountFilter() ?? 'master') as SubAccount;
  const isMCL = subAccount === 'mcl';

  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [partDocs, setPartDocs] = useState<string[]>([]);

  // Tabs
  const [activeCategory, setActiveCategory] = useState<Category>('batteries_critical');
  const [activePartType, setActivePartType] = useState<PartType>('new');

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTruck, setFilterTruck] = useState('');
  const [filterSubAccount, setFilterSubAccount] = useState('');

  // History panel
  const [historyPart, setHistoryPart] = useState<SparePart | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [logActionOpen, setLogActionOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    action: 'installed' as HistoryAction,
    action_date: new Date().toISOString().split('T')[0],
    vehicle_id: '',
    performed_by: '',
    notes: '',
  });

  const emptyForm = {
    serial_number: '',
    part_name: '',
    category: 'batteries_critical' as Category,
    part_type: 'new' as PartType,
    status: 'in_store' as PartStatus,
    sub_account: subAccount as string,
    supplier: '',
    purchase_date: '',
    unit_cost: null as number | null,
    current_truck_id: '',
    installed_date: '',
    notes: '',
  };

  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('spare_parts_v2')
      .select('*, vehicle:vehicles(plate_number, make, model)')
      .order('created_at', { ascending: false });

    if (isMaster && filterSubAccount) {
      query = query.eq('sub_account', filterSubAccount);
    }

    const [partsRes, vehRes] = await Promise.all([
      query,
      supabase.from('vehicles').select('id, plate_number, make, model').order('plate_number'),
    ]);
    setParts(partsRes.data as SparePart[] || []);
    setVehicles(vehRes.data || []);
    setLoading(false);
  }, [isMaster, filterSubAccount]);

  useEffect(() => { loadData(); }, [loadData]);

  // MCL area filter
  const areaFiltered = useMemo(() => {
    if (isMCL && mclArea && !isMaster) {
      return parts.filter(p => p.mcl_area_id === mclArea);
    }
    return parts;
  }, [parts, isMCL, mclArea, isMaster]);

  // Tab + filter logic
  const filteredParts = useMemo(() => {
    return areaFiltered.filter(p => {
      if (p.category !== activeCategory) return false;
      if (p.part_type !== activePartType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.serial_number.toLowerCase().includes(q) && !p.part_name.toLowerCase().includes(q)) return false;
      }
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterTruck && p.current_truck_id !== filterTruck) return false;
      return true;
    });
  }, [areaFiltered, activeCategory, activePartType, search, filterStatus, filterTruck]);

  const openAdd = () => {
    setForm({ ...emptyForm, category: activeCategory, part_type: activePartType });
    setEditId(null);
    setPartDocs([]);
    setModalOpen(true);
  };

  const openEdit = (p: SparePart) => {
    const { id, vehicle, created_at, mcl_area_id, documents, ...rest } = p as any;
    setForm({ ...rest, current_truck_id: rest.current_truck_id || '', installed_date: rest.installed_date || '', purchase_date: rest.purchase_date || '' });
    setEditId(id);
    setPartDocs(documents || []);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload: any = { ...form };
    if (!payload.current_truck_id) payload.current_truck_id = null;
    if (!payload.installed_date) payload.installed_date = null;
    if (!payload.purchase_date) payload.purchase_date = null;
    if (isMCL && mclArea && !isMaster) payload.mcl_area_id = mclArea;

    if (editId) {
      const { error } = await supabase.from('spare_parts_v2').update(payload).eq('id', editId);
      if (error) showToast('Failed to save: ' + error.message, 'error');
      else showToast('Spare part updated', 'success');
    } else {
      const { error } = await supabase.from('spare_parts_v2').insert(payload);
      if (error) {
        showToast(error.code === '23505' ? 'Serial number already exists for this sub-account' : 'Failed to create: ' + error.message, 'error');
        setSaving(false);
        return;
      }
      showToast('Spare part created', 'success');
    }
    setSaving(false);
    setModalOpen(false);
    loadData();
  };

  // History panel
  const openHistory = async (part: SparePart) => {
    setHistoryPart(part);
    setHistoryLoading(true);
    const { data } = await supabase
      .from('spare_part_history')
      .select('*, vehicle:vehicles(plate_number)')
      .eq('spare_part_id', part.id)
      .order('action_date', { ascending: false });
    setHistoryEntries(data as HistoryEntry[] || []);
    setHistoryLoading(false);
  };

  const openLogAction = () => {
    setLogForm({
      action: 'installed',
      action_date: new Date().toISOString().split('T')[0],
      vehicle_id: historyPart?.current_truck_id || '',
      performed_by: profile?.full_name || '',
      notes: '',
    });
    setLogActionOpen(true);
  };

  const saveLogAction = async () => {
    if (!historyPart) return;
    let durationDays: number | null = null;

    if (logForm.action === 'removed') {
      // Find the last 'installed' entry to calculate duration
      const lastInstalled = historyEntries
        .slice()
        .reverse()
        .find(e => e.action === 'installed');
      if (lastInstalled) {
        const diff = new Date(logForm.action_date).getTime() - new Date(lastInstalled.action_date).getTime();
        durationDays = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      }
    }

    const payload: any = {
      spare_part_id: historyPart.id,
      action: logForm.action,
      action_date: logForm.action_date,
      vehicle_id: logForm.vehicle_id || null,
      duration_days: durationDays,
      performed_by: logForm.performed_by || null,
      notes: logForm.notes || null,
    };

    const { error } = await supabase.from('spare_part_history').insert(payload);
    if (error) {
      showToast('Failed to log action: ' + error.message, 'error');
      return;
    }

    // Update part status based on action
    const statusMap: Record<HistoryAction, PartStatus> = {
      installed: 'in_use',
      removed: 'in_store',
      sent_for_repair: 'under_repair',
      returned_from_repair: 'in_store',
      retired: 'retired',
    };
    const updatePayload: any = { status: statusMap[logForm.action] };
    if (logForm.action === 'installed') {
      updatePayload.current_truck_id = logForm.vehicle_id || null;
      updatePayload.installed_date = logForm.action_date;
    } else if (logForm.action === 'removed' || logForm.action === 'retired') {
      updatePayload.current_truck_id = null;
      if (logForm.action === 'retired') updatePayload.installed_date = null;
    }

    await supabase.from('spare_parts_v2').update(updatePayload).eq('id', historyPart.id);

    showToast(`Action logged: ${ACTION_LABELS[logForm.action]}`, 'success');
    setLogActionOpen(false);
    loadData();
    // Refresh history
    if (historyPart) openHistory({ ...historyPart, status: statusMap[logForm.action] });
  };

  const fmtKES = (n: number | null) => n != null ? n.toLocaleString() : '—';

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Spare Parts"
        subtitle="Track individual parts with serial numbers, lifecycle status, and movement history"
        icon={<Wrench className="h-6 w-6" />}
        iconColor={portalColor}
        onAdd={openAdd}
        addLabel="Add Spare Part"
        templateName="spare_parts"
      />

      {/* Master sub-account filter */}
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

      {/* Category Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === tab.id ? 'text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            style={activeCategory === tab.id ? { background: portalColor } : undefined}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Part Type Sub-Tabs */}
      <div className="flex gap-2">
        {PART_TYPE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActivePartType(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activePartType === tab.id
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9 text-sm" placeholder="Search serial no. or part name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto text-sm py-1.5" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="in_store">In Store</option>
          <option value="in_use">In Use</option>
          <option value="under_repair">Under Repair</option>
          <option value="retired">Retired</option>
        </select>
        <select className="input w-auto text-sm py-1.5" value={filterTruck} onChange={e => setFilterTruck(e.target.value)}>
          <option value="">All Trucks</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
        </select>
        {(search || filterStatus || filterTruck) && (
          <button
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterTruck(''); }}
            className="text-xs hover:underline font-medium whitespace-nowrap"
            style={{ color: portalColor }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner message="Loading spare parts..." />
      ) : filteredParts.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Package className="h-8 w-8" />} title="No spare parts found" message="Add a part or adjust your filters and category tabs." />
        </div>
      ) : (
        <div className="card table-wrapper overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial No</th>
                <th>Part Name</th>
                <th>Status</th>
                <th>Current Truck</th>
                <th>Installed Date</th>
                <th>Days In Use</th>
                {isMaster && <th>Sub-Account</th>}
                <th>Supplier</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map(p => {
                const badge = STATUS_BADGES[p.status];
                const days = p.status === 'in_use' ? daysSince(p.installed_date) : null;
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openHistory(p)}>
                    <td className="font-bold text-slate-800">{p.serial_number}</td>
                    <td className="font-medium text-slate-700">{p.part_name}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                    </td>
                    <td className="text-slate-600">{p.vehicle?.plate_number || '—'}</td>
                    <td className="text-slate-600">{p.installed_date || '—'}</td>
                    <td className="text-slate-600">{days != null ? `${days} days` : '—'}</td>
                    {isMaster && <td><span className="text-xs font-semibold uppercase text-slate-500">{p.sub_account}</span></td>}
                    <td className="text-slate-600">{p.supplier || '—'}</td>
                    <td className="text-slate-500 text-sm max-w-xs truncate">{p.notes || '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => openHistory(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                          <History className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Spare Part' : 'Add Spare Part'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Serial Number *</label>
            <input type="text" className="input" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} placeholder="e.g. BAT-001" />
          </div>
          <div>
            <label className="label">Part Name *</label>
            <input type="text" className="input" value={form.part_name} onChange={e => setForm({ ...form, part_name: e.target.value })} placeholder="e.g. Heavy Duty Battery 12V" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Category })}>
              <option value="batteries_critical">Batteries & Critical Parts</option>
              <option value="general">General Spares</option>
            </select>
          </div>
          <div>
            <label className="label">Part Type</label>
            <select className="input" value={form.part_type} onChange={e => setForm({ ...form, part_type: e.target.value as PartType })}>
              <option value="new">New</option>
              <option value="rebound">Rebound</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as PartStatus })}>
              <option value="in_store">In Store</option>
              <option value="in_use">In Use</option>
              <option value="under_repair">Under Repair</option>
              <option value="retired">Retired</option>
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
            <label className="label">Supplier</label>
            <input type="text" className="input" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
          </div>
          <div>
            <label className="label">Purchase Date</label>
            <input type="date" className="input" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Unit Cost (KES)</label>
            <input type="number" step="0.01" className="input" value={form.unit_cost ?? ''} onChange={e => setForm({ ...form, unit_cost: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label className="label">Current Truck</label>
            <select className="input" value={form.current_truck_id} onChange={e => setForm({ ...form, current_truck_id: e.target.value })}>
              <option value="">None / In Store</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} ({v.make} {v.model})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Installed Date</label>
            <input type="date" className="input" value={form.installed_date} onChange={e => setForm({ ...form, installed_date: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DocumentUpload
          folder="spare_parts_v2"
          recordId={editId || 'unsaved'}
          existingDocs={partDocs}
          onDocsChange={setPartDocs}
        />

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || !form.serial_number || !form.part_name} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Part' : 'Save Part'}</button>
        </div>
      </Modal>

      {/* History Slide-Out Panel */}
      {historyPart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setHistoryPart(null); setLogActionOpen(false); }} />
          <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto animate-fade-in">
            {/* Panel Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-slate-500" />
                <h3 className="text-base font-bold text-slate-900">Movement History</h3>
              </div>
              <button onClick={() => { setHistoryPart(null); setLogActionOpen(false); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Part Info */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGES[historyPart.status].bg} ${STATUS_BADGES[historyPart.status].text}`}>
                  {STATUS_BADGES[historyPart.status].label}
                </span>
              </div>
              <p className="text-lg font-bold text-slate-800">{historyPart.part_name}</p>
              <p className="text-sm text-slate-500">Serial: {historyPart.serial_number}</p>
              <p className="text-xs text-slate-400 mt-1 capitalize">{historyPart.category.replace('_', ' ')} · {historyPart.part_type}</p>
              {historyPart.vehicle?.plate_number && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <TruckIcon className="h-3 w-3" /> {historyPart.vehicle.plate_number}
                </p>
              )}
            </div>

            {/* Log Action Button */}
            <div className="px-5 py-3 border-b border-slate-100">
              {!logActionOpen ? (
                <button
                  onClick={openLogAction}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: portalColor }}
                >
                  <Plus className="h-4 w-4" /> Log Action
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-700">Log New Action</h4>
                  <div>
                    <label className="label">Action</label>
                    <select className="input text-sm" value={logForm.action} onChange={e => setLogForm({ ...logForm, action: e.target.value as HistoryAction })}>
                      <option value="installed">Installed</option>
                      <option value="removed">Removed</option>
                      <option value="sent_for_repair">Sent for Repair</option>
                      <option value="returned_from_repair">Returned from Repair</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Date</label>
                    <input type="date" className="input text-sm" value={logForm.action_date} onChange={e => setLogForm({ ...logForm, action_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Truck</label>
                    <select className="input text-sm" value={logForm.vehicle_id} onChange={e => setLogForm({ ...logForm, vehicle_id: e.target.value })}>
                      <option value="">None</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Performed By</label>
                    <input type="text" className="input text-sm" value={logForm.performed_by} onChange={e => setLogForm({ ...logForm, performed_by: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <input type="text" className="input text-sm" value={logForm.notes} onChange={e => setLogForm({ ...logForm, notes: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setLogActionOpen(false)} className="btn-secondary text-sm flex-1">Cancel</button>
                    <button onClick={saveLogAction} className="btn-primary text-sm flex-1">Log Action</button>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="px-5 py-4">
              {historyLoading ? (
                <LoadingSpinner message="Loading history..." />
              ) : historyEntries.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No history entries yet. Log an action to start tracking.</p>
              ) : (
                <div className="space-y-3">
                  {historyEntries.map((entry, idx) => (
                    <div key={entry.id} className="relative pl-6">
                      {/* Timeline line */}
                      {idx < historyEntries.length - 1 && (
                        <div className="absolute left-2 top-3 bottom-[-12px] w-px bg-slate-200" />
                      )}
                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-white ${ACTION_COLORS[entry.action].replace('text-', 'bg-')}`} />

                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-semibold ${ACTION_COLORS[entry.action]}`}>
                            {ACTION_LABELS[entry.action]}
                          </span>
                          <span className="text-xs text-slate-400">{entry.action_date}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate-500">
                          {entry.vehicle?.plate_number && (
                            <span className="flex items-center gap-1"><TruckIcon className="h-3 w-3" /> {entry.vehicle.plate_number}</span>
                          )}
                          {entry.duration_days != null && (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {entry.duration_days} days</span>
                          )}
                          {entry.performed_by && (
                            <span>by {entry.performed_by}</span>
                          )}
                        </div>
                        {entry.notes && <p className="mt-1.5 text-xs text-slate-500">{entry.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
