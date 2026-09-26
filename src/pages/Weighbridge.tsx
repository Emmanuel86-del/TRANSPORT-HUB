import { useEffect, useState, useCallback } from 'react';
import { Scale, Search, Trash2, Edit, Flag, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { WeighbridgeEntry, WeighbridgeEntryInsert } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/Shared';

const emptyForm: WeighbridgeEntryInsert = {
  date: new Date().toISOString().slice(0, 10),
  ticket_no: '',
  lorry_no: '',
  goods: '',
  lot_route_consignee: '',
  qty_units: '',
  weight_kg: null,
  flag_for_review: false,
  review_notes: '',
  notes: '',
};

type DateSummary = { date: string; entries: number; total_weight: number };
type LotSummary = { lot_route_consignee: string; entries: number; qty: number; total_weight: number };

export function Weighbridge() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WeighbridgeEntry[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ledger' | 'by-date' | 'by-lot' | 'review'>('ledger');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<WeighbridgeEntryInsert>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('weighbridge_entries').select('*').order('date', { ascending: false }).order('ticket_no', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e => {
    const matchSearch = !search ||
      e.ticket_no.toLowerCase().includes(search.toLowerCase()) ||
      e.lorry_no?.toLowerCase().includes(search.toLowerCase()) ||
      e.goods?.toLowerCase().includes(search.toLowerCase()) ||
      e.lot_route_consignee?.toLowerCase().includes(search.toLowerCase());
    if (activeTab === 'review') return matchSearch && e.flag_for_review;
    return matchSearch;
  });

  // Summary by date
  const dateSummary: DateSummary[] = [];
  const dateMap = new Map<string, DateSummary>();
  let cumulative = 0;
  const sortedByDate = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sortedByDate) {
    if (!dateMap.has(e.date)) {
      dateMap.set(e.date, { date: e.date, entries: 0, total_weight: 0 });
      dateSummary.push(dateMap.get(e.date)!);
    }
    const row = dateMap.get(e.date)!;
    row.entries++;
    row.total_weight += e.weight_kg || 0;
  }
  dateSummary.sort((a, b) => b.date.localeCompare(a.date));

  // Summary by lot/route
  const lotSummary: LotSummary[] = [];
  const lotMap = new Map<string, LotSummary>();
  for (const e of entries) {
    const key = e.lot_route_consignee || 'Unspecified';
    if (!lotMap.has(key)) {
      lotMap.set(key, { lot_route_consignee: key, entries: 0, qty: 0, total_weight: 0 });
      lotSummary.push(lotMap.get(key)!);
    }
    const row = lotMap.get(key)!;
    row.entries++;
    row.total_weight += e.weight_kg || 0;
    const qtyMatch = e.qty_units?.match(/^(\d+)/);
    if (qtyMatch) row.qty += parseInt(qtyMatch[1]);
  }
  lotSummary.sort((a, b) => b.total_weight - a.total_weight);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true); };
  const openEdit = (e: WeighbridgeEntry) => {
    const { id, created_at, ...rest } = e;
    setForm(rest); setEditId(id); setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    if (editId) {
      await supabase.from('weighbridge_entries').update(form).eq('id', editId);
    } else {
      await supabase.from('weighbridge_entries').insert(form);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from('weighbridge_entries').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const update = <K extends keyof WeighbridgeEntryInsert>(key: K, value: WeighbridgeEntryInsert[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const totalWeight = filtered.reduce((sum, e) => sum + (e.weight_kg || 0), 0);
  const reviewCount = entries.filter(e => e.flag_for_review).length;

  // Cumulative weight calc for by-date view
  let runningCumulative = 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Weighbridge Ledger" subtitle="Weighbridge ticket entries and weight summaries" icon={<Scale className="h-6 w-6" />} onAdd={openAdd} addLabel="Add Entry" />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        <button onClick={() => setActiveTab('ledger')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ledger' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Ledger</button>
        <button onClick={() => setActiveTab('by-date')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'by-date' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Summary by Date</button>
        <button onClick={() => setActiveTab('by-lot')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'by-lot' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Summary by Lot/Route</button>
        <button onClick={() => setActiveTab('review')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'review' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Flag className="h-3.5 w-3.5" /> Needs Review
          {reviewCount > 0 && <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5">{reviewCount}</span>}
        </button>
      </div>

      {(activeTab === 'ledger' || activeTab === 'review') && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search by ticket, lorry, goods..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <LoadingSpinner message="Loading entries..." />
          ) : filtered.length === 0 ? (
            <div className="card"><EmptyState icon={<Scale className="h-8 w-8" />} title={activeTab === 'review' ? 'No entries need review' : 'No entries found'} message={activeTab === 'review' ? 'All weighbridge entries have been verified.' : 'Add your first weighbridge entry to start the ledger.'} /></div>
          ) : (
            <>
              <div className="flex gap-3 text-sm text-slate-500">
                <span>{filtered.length} entries</span>
                <span>·</span>
                <span>Total weight: <strong className="text-slate-700">{totalWeight.toLocaleString()} kg</strong></span>
              </div>
              <div className="card table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ticket No.</th>
                      <th>Lorry</th>
                      <th>Goods</th>
                      <th>Lot / Route / Consignee</th>
                      <th>Qty / Units</th>
                      <th>Weight (kg)</th>
                      <th>Flag</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr key={e.id} className={e.flag_for_review ? 'bg-amber-50/50' : ''}>
                        <td className="font-medium text-slate-800 whitespace-nowrap">{e.date}</td>
                        <td className="font-mono text-xs text-slate-600">{e.ticket_no}</td>
                        <td className="text-slate-600">{e.lorry_no || '—'}</td>
                        <td className="text-slate-700">{e.goods || '—'}</td>
                        <td className="text-slate-600 text-sm">{e.lot_route_consignee || '—'}</td>
                        <td className="text-slate-600 text-sm">{e.qty_units || '—'}</td>
                        <td className="font-semibold text-slate-800">{e.weight_kg ? e.weight_kg.toLocaleString() : '—'}</td>
                        <td>{e.flag_for_review ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Review</span> : <span className="text-slate-300">—</span>}</td>
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
            </>
          )}
        </>
      )}

      {activeTab === 'by-date' && (
        <>
          {loading ? (
            <LoadingSpinner message="Loading summary..." />
          ) : dateSummary.length === 0 ? (
            <div className="card"><EmptyState icon={<Scale className="h-8 w-8" />} title="No data" message="Add weighbridge entries to see date summaries." /></div>
          ) : (
            <div className="card table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Entries</th>
                    <th>Total Weight (kg)</th>
                    <th>Cumulative Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {dateSummary.map(row => {
                    runningCumulative += row.total_weight;
                    return (
                      <tr key={row.date}>
                        <td className="font-medium text-slate-800">{row.date}</td>
                        <td className="text-slate-600">{row.entries}</td>
                        <td className="font-semibold text-slate-800">{row.total_weight.toLocaleString()}</td>
                        <td className="font-semibold text-blue-600">{runningCumulative.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold">
                    <td>Total</td>
                    <td>{dateSummary.reduce((s, r) => s + r.entries, 0)}</td>
                    <td className="text-slate-800">{runningCumulative.toLocaleString()}</td>
                    <td className="text-blue-600">{runningCumulative.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'by-lot' && (
        <>
          {loading ? (
            <LoadingSpinner message="Loading summary..." />
          ) : lotSummary.length === 0 ? (
            <div className="card"><EmptyState icon={<Scale className="h-8 w-8" />} title="No data" message="Add weighbridge entries to see lot/route summaries." /></div>
          ) : (
            <div className="card table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lot / Route / Consignee</th>
                    <th>Entries</th>
                    <th>Total Units</th>
                    <th>Total Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {lotSummary.map(row => (
                    <tr key={row.lot_route_consignee}>
                      <td className="font-medium text-slate-800">{row.lot_route_consignee}</td>
                      <td className="text-slate-600">{row.entries}</td>
                      <td className="text-slate-600">{row.qty.toLocaleString()}</td>
                      <td className="font-semibold text-slate-800">{row.total_weight.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Entry' : 'Add Weighbridge Entry'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={form.date} onChange={e => update('date', e.target.value)} />
          </div>
          <div>
            <label className="label">Ticket No. *</label>
            <input className="input" value={form.ticket_no} onChange={e => update('ticket_no', e.target.value)} placeholder="e.g., WB-013" />
          </div>
          <div>
            <label className="label">Lorry No.</label>
            <input className="input" value={form.lorry_no || ''} onChange={e => update('lorry_no', e.target.value)} placeholder="e.g., KDA 123A" />
          </div>
          <div>
            <label className="label">Weight (kg)</label>
            <input type="number" className="input" value={form.weight_kg ?? ''} onChange={e => update('weight_kg', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <label className="label">Goods</label>
            <input className="input" value={form.goods || ''} onChange={e => update('goods', e.target.value)} placeholder="e.g., Cement" />
          </div>
          <div>
            <label className="label">Lot / Route / Consignee</label>
            <input className="input" value={form.lot_route_consignee || ''} onChange={e => update('lot_route_consignee', e.target.value)} placeholder="e.g., Lot A / Mombasa-Nairobi / Bamburi" />
          </div>
          <div>
            <label className="label">Qty / Units</label>
            <input className="input" value={form.qty_units || ''} onChange={e => update('qty_units', e.target.value)} placeholder="e.g., 500 bags" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" id="flag" checked={form.flag_for_review} onChange={e => update('flag_for_review', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
            <label htmlFor="flag" className="text-sm text-slate-700 flex items-center gap-1"><Flag className="h-3.5 w-3.5 text-amber-500" /> Flag for review</label>
          </div>
          {form.flag_for_review && (
            <div className="sm:col-span-2">
              <label className="label">Review Notes</label>
              <textarea className="input" rows={2} value={form.review_notes || ''} onChange={e => update('review_notes', e.target.value)} placeholder="Describe the data issue..." />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes || ''} onChange={e => update('notes', e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || !form.ticket_no} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update Entry' : 'Add Entry'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Entry" message="Are you sure you want to delete this weighbridge entry?" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
