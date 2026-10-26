import { useEffect, useState, useCallback, useMemo } from 'react';
import { Wrench, Plus, Edit, Search, History, Package, Battery, Upload } from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount, MCLArea } from '@/lib/portals';
import { BulkImportModal } from '@/components/BulkImportModal';

export function SparePartsV2({ mclArea, portalColor, isMaster = false }: { mclArea: MCLArea | null; portalColor: string; isMaster?: boolean }) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const subAccount = (profile?.sub_account ?? getSubAccountFilter() ?? 'master') as SubAccount;

  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<any[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('spare_parts_v2').select('*, vehicle:vehicles(plate_number)').order('created_at', { ascending: false });
    setParts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          title="Spare Parts"
          subtitle="Track individual parts with serial numbers and lifecycle status"
          icon={<Wrench className="h-6 w-6" />}
          iconColor={portalColor}
        />
        {!isMaster && (
          <button
            onClick={() => setIsBulkOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Upload className="h-4 w-4 text-slate-500" />
            Bulk Import
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading spare parts..." />
      ) : parts.length === 0 ? (
        <div className="card"><EmptyState icon={<Package className="h-8 w-8" />} title="No spare parts found" message="Get started by adding parts." /></div>
      ) : (
        <div className="card table-wrapper overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Serial No</th><th>Part Name</th><th>Status</th><th>Current Truck</th><th>Supplier</th></tr>
            </thead>
            <tbody>
              {parts.map(p => (
                <tr key={p.id}>
                  <td className="font-bold text-slate-800">{p.serial_number}</td>
                  <td>{p.part_name}</td>
                  <td>{p.status}</td>
                  <td>{p.vehicle?.plate_number || '—'}</td>
                  <td>{p.supplier || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BulkImportModal
        open={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        tableName="spare_parts_v2"
        portalColor={portalColor}
        subAccount={subAccount}
        sampleColumns={['serial_number', 'part_name', 'category', 'part_type', 'status', 'supplier', 'unit_cost', 'notes']}
        onSuccess={loadData}
      />
    </div>
  );
}
