import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { RotateCw, Truck, X, Download, Upload } from 'lucide-react';
import { BulkImportModal } from '@/components/BulkImportModal';

export function TyresPage({ color, subAccountFilter, isMaster = false }: { color: string; subAccountFilter?: string; isMaster?: boolean }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'inventory' | 'retired'>('active');
  const [tyres, setTyres] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const effectiveFilter = subAccountFilter ?? (profile?.sub_account === 'master' ? 'all' : profile?.sub_account ?? 'all');

  // ... (keep loadData, etc.)

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tyre Management"
        subtitle={isMaster ? 'Master monitoring view — tracking active tyres and rotations across sub-accounts' : 'Track active tyres, inventory, and rotations'}
        icon={<RotateCw className="h-6 w-6" />}
        iconColor={color}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          {(['active', 'inventory', 'retired'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-colors ${
                activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab} Tyres
            </button>
          ))}
        </div>
        {!isMaster && (
          <button
            onClick={() => setIsBulkOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg shadow-sm"
            style={{ background: color }}
          >
            <Upload className="h-3.5 w-3.5" /> Bulk Import Tyres
          </button>
        )}
      </div>

      {/* ... rest of your TyresPage JSX ... */}

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
