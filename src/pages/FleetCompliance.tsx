import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, Calendar, Bell, ExternalLink, Edit, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState } from '@/components/Shared';

interface ComplianceRecord {
  id: string;
  vehicle_id: string;
  vehicle?: { plate_number: string; make_model: string };
  comesa_start: string;
  comesa_expiry: string;
  ntsa_inspection_start: string;
  ntsa_inspection_expiry: string;
  truck_insurance_start: string;
  truck_insurance_expiry: string;
  trailer_insurance_start: string;
  trailer_insurance_expiry: string;
}

// Helper to check expiry status (returns 'expired', 'warning-1m', 'warning-2w', or 'ok')
function getExpiryStatus(expiryDateStr: string) {
  if (!expiryDateStr) return 'ok';
  const today = new Date();
  const expiry = new Date(expiryDateStr);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 14) return 'warning-2w'; // 2 weeks or less
  if (diffDays <= 30) return 'warning-1m'; // 1 month or less
  return 'ok';
}

function StatusBadge({ date }: { date: string }) {
  const status = getExpiryStatus(date);
  if (!date) return <span className="text-slate-300">—</span>;

  if (status === 'expired') {
    return <span className="badge-danger flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Expired ({date})</span>;
  }
  if (status === 'warning-2w') {
    return <span className="badge-danger flex items-center gap-1"><Bell className="h-3 w-3" /> Expiring in &lt;2 wks ({date})</span>;
  }
  if (status === 'warning-1m') {
    return <span className="badge-warning flex items-center gap-1"><Bell className="h-3 w-3" /> Expiring in &lt;1 mo ({date})</span>;
  }
  return <span className="badge-success">{date}</span>;
}

export function FleetCompliance() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    vehicle_id: '',
    insurance_start: '',
    insurance_expiry: '',
    comesa_start: '',
    comesa_expiry: '',
    ntsa_inspection_start: '',
    ntsa_inspection_expiry: '',
    truck_insurance_start: '',
    truck_insurance_expiry: '',
    trailer_insurance_start: '',
    trailer_insurance_expiry: '',
  };

  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [compRes, vehRes] = await Promise.all([
      supabase.from('vehicle_compliance').select('*, vehicle:vehicles(plate_number, make_model)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('id, plate_number, make_model').order('plate_number'),
    ]);
    setRecords(compRes.data || []);
    setVehicles(vehRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute active alarms count
  const activeAlarms = records.filter(r => {
    return [r.insurance_expiry, r.comesa_expiry, r.ntsa_inspection_expiry, r.truck_insurance_expiry, r.trailer_insurance_expiry]
      .some(date => {
        const s = getExpiryStatus(date);
        return s === 'expired' || s === 'warning-2w' || s === 'warning-1m';
      });
  });

  const saveRecord = async () => {
    setSaving(true);
    if (editId) {
      await supabase.from('vehicle_compliance').update(form).eq('id', editId);
    } else {
      await supabase.from('vehicle_compliance').insert(form);
    }
    setSaving(false);
    setModalOpen(false);
    loadData();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader 
        title="Fleet Compliance & Insurance" 
        subtitle="Monitor Insurance, COMESA, NTSA Inspections, Truck & Trailer Expirations" 
        icon={<ShieldCheck className="h-6 w-6" />} 
        onAdd={() => { setForm(emptyForm); setEditId(null); setModalOpen(true); }} 
        addLabel="Add Compliance Record" 
      />

      {/* Alarm Notification Banner */}
      {activeAlarms.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <Bell className="h-5 w-5 text-amber-600 mt-0.5 animate-bounce" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">Compliance Expiry Notice</h4>
            <p className="text-sm text-amber-700 mt-0.5">
              You have <span className="font-semibold">{activeAlarms.length}</span> vehicle(s) with compliance documents expiring within 1 month or already expired. Please review below.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading compliance records..." />
      ) : records.length === 0 ? (
        <div className="card">
          <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="No compliance logs found" message="Add compliance and insurance schedules for your trucks." />
        </div>
      ) : (
        <div className="card table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>General Insurance</th>
                <th>COMESA Insurance</th>
                <th>NTSA Inspection</th>
                <th>Truck Insurance</th>
                <th>Trailer Insurance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td className="font-semibold text-slate-800">
                    {r.vehicle?.plate_number || 'Unknown'} <span className="block text-xs font-normal text-slate-500">{r.vehicle?.make_model}</span>
                  </td>
                  <td>
                    <div className="text-xs">Start: {r.insurance_start || '—'}</div>
                    <StatusBadge date={r.insurance_expiry} />
                  </td>
                  <td>
                    <div className="text-xs">Start: {r.comesa_start || '—'}</div>
                    <StatusBadge date={r.comesa_expiry} />
                  </td>
                  <td>
                    <div className="text-xs">Start: {r.ntsa_inspection_start || '—'}</div>
                    <StatusBadge date={r.ntsa_inspection_expiry} />
                  </td>
                  <td>
                    <div className="text-xs">Start: {r.truck_insurance_start || '—'}</div>
                    <StatusBadge date={r.truck_insurance_expiry} />
                  </td>
                  <td>
                    <div className="text-xs">Start: {r.trailer_insurance_start || '—'}</div>
                    <StatusBadge date={r.trailer_insurance_expiry} />
                  </td>
                  <td>
                    <button 
                      onClick={() => {
                        const { id, created_at, vehicle, ...rest } = r as any;
                        setForm(rest);
                        setEditId(id);
                        setModalOpen(true);
                      }} 
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Compliance Record' : 'Add Fleet Compliance'} size="xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Select Vehicle *</label>
            <select className="input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">Choose vehicle plate number</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} ({v.make_model})</option>)}
            </select>
          </div>

          {/* General Insurance */}
          <div className="sm:col-span-2 border-t pt-3 font-semibold text-sm text-slate-700">General Insurance</div>
          <div><label className="label">Start Date</label><input type="date" className="input" value={form.insurance_start} onChange={e => setForm({ ...form, insurance_start: e.target.value })} /></div>
          <div><label className="label">Expiry Date (Alarm Trigger)</label><input type="date" className="input" value={form.insurance_expiry} onChange={e => setForm({ ...form, insurance_expiry: e.target.value })} /></div>

          {/* COMESA Insurance */}
          <div className="sm:col-span-2 border-t pt-3 font-semibold text-sm text-slate-700">COMESA Insurance</div>
          <div><label className="label">Start Date</label><input type="date" className="input" value={form.comesa_start} onChange={e => setForm({ ...form, comesa_start: e.target.value })} /></div>
          <div><label className="label">Expiry Date (Alarm Trigger)</label><input type="date" className="input" value={form.comesa_expiry} onChange={e => setForm({ ...form, comesa_expiry: e.target.value })} /></div>

          {/* NTSA Inspection */}
          <div className="sm:col-span-2 border-t pt-3 font-semibold text-sm text-slate-700">NTSA Inspection</div>
          <div><label className="label">Start Date</label><input type="date" className="input" value={form.ntsa_inspection_start} onChange={e => setForm({ ...form, ntsa_inspection_start: e.target.value })} /></div>
          <div><label className="label">Expiry Date (Alarm Trigger)</label><input type="date" className="input" value={form.ntsa_inspection_expiry} onChange={e => setForm({ ...form, ntsa_inspection_expiry: e.target.value })} /></div>

          {/* Truck Insurance */}
          <div className="sm:col-span-2 border-t pt-3 font-semibold text-sm text-slate-700">Truck Insurance</div>
          <div><label className="label">Start Date</label><input type="date" className="input" value={form.truck_insurance_start} onChange={e => setForm({ ...form, truck_insurance_start: e.target.value })} /></div>
          <div><label className="label">Expiry Date (Alarm Trigger)</label><input type="date" className="input" value={form.truck_insurance_expiry} onChange={e => setForm({ ...form, truck_insurance_expiry: e.target.value })} /></div>

          {/* Trailer Insurance */}
          <div className="sm:col-span-2 border-t pt-3 font-semibold text-sm text-slate-700">Trailer Insurance</div>
          <div><label className="label">Start Date</label><input type="date" className="input" value={form.trailer_insurance_start} onChange={e => setForm({ ...form, trailer_insurance_start: e.target.value })} /></div>
          <div><label className="label">Expiry Date (Alarm Trigger)</label><input type="date" className="input" value={form.trailer_insurance_expiry} onChange={e => setForm({ ...form, trailer_insurance_expiry: e.target.value })} /></div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={saveRecord} disabled={saving || !form.vehicle_id} className="btn-primary">{saving ? 'Saving...' : 'Save Compliance'}</button>
        </div>
      </Modal>
    </div>
  );
}
