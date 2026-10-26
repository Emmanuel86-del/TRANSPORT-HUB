import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { RotateCw, Truck, Upload } from 'lucide-react';
import { BulkImportModal } from '@/components/BulkImportModal';

export function TyresPage({ color, subAccountFilter, isMaster = false }: { color: string; subAccountFilter?: string; isMaster?: boolean }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tyres, setTyres] = useState<any[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const effectiveFilter = subAccountFilter ?? (profile?.sub_account === 'master' ? 'all' : profile?.sub_account ?? 'all');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('tyres').select('*');
    setTyres(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Tyre Management" subtitle="Track active tyres, inventory, and rotations" icon={<RotateCw className="h-6 w-6" />} iconColor={color} />
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

      <BulkImportModal
        open={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        tableName="tyres"
        portalColor={color}
        subAccount={effectiveFilter === 'all' ? 'mcl' : effectiveFilter}
        sampleColumns={['serial_number', 'position', 'status', 'cost', 'total_km']}
        onSuccess={loadData}
      />
    </div>
  );
}
