import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Wrench, Plus, Edit, Search, X, History, Package,
  Battery, Truck as TruckIcon, Clock,
} from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { DocumentUpload } from '@/components/DocumentUpload';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount, MCLArea } from '@/lib/portals';
import { downloadExcelTemplate } from '@/lib/excelTemplates';
import { UploadModal } from '@/components/UploadModal';

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
  { id: 'general', label: 'General Spares', icon: <Wrench className="h-4 w-4" /> },
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
  const [isUploadOpen, setIsUploadOpen] = useState(false);

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

  const areaFiltered = useMemo(() => {
    if (isMCL && mclArea && !isMaster) {
      return parts.filter(p => p.mcl_area_id === mclArea);
    }
    return parts;
  }, [parts, isMCL, mclArea, isMaster]);

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
    if (isMaster) return;
    setForm({ ...emptyForm, category: activeCategory, part_type: activePartType });
    setEditId(null);
    setPartDocs([]);
    setModalOpen(true);
  };

  const openEdit = (p: SparePart) => {
    if (isMaster) return;
    const { id, vehicle, created_at, mcl_area_id, documents, ...rest } = p as any;
    setForm({ ...rest, current_truck_id: rest.current_truck_id || '', installed_date: rest.installed_date || '', purchase_date: rest.purchase_date || '' });
    setEditId(id);
    setPartDocs(documents || []);
    setModalOpen(true);
  };

  const save = async () => {
    if (isMaster) return;
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

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Spare Parts"
        subtitle={isMaster ? 'Master monitoring view — viewing spare parts across sub-accounts' : 'Track individual parts with serial numbers, lifecycle status, and movement history'}
        icon={<Wrench className="h-6 w-6" />}
        iconColor={portalColor}
        onAdd={!isMaster ? openAdd : undefined}
        addLabel="Add Spare Part"
        onUploadClick={!isMaster ? () => setIsUploadOpen(true) : undefined}
        onDownloadTemplate={() => downloadExcelTemplate('spare_parts')}
      />

      {/* Master sub-account filter */}
      {isMaster && (
        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
          <label className="text-sm font-medium text-slate-600">Filter Sub-Account:</label>
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
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner message="Loading spare parts..." />
      ) : filteredParts.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Package className="h-8 w-8" />} title="No spare parts found" message="No records available for the selected filters." />
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
                {!isMaster && <th></th>}
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
                    {!isMaster && (
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
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
