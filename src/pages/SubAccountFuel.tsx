import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Fuel as FuelIcon, Plus, Edit, Filter, ChevronDown, ChevronUp,
  TrendingUp, AlertTriangle, DollarSign, Truck as TruckIcon, Upload,
} from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { DocumentUpload } from '@/components/DocumentUpload';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { SubAccount, MCLArea } from '@/lib/portals';
import { BulkImportModal } from '@/components/BulkImportModal';

export function SubAccountFuel({ mclArea, portalColor }: { mclArea: MCLArea | null; portalColor: string }) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const subAccount = (profile?.sub_account ?? getSubAccountFilter() ?? 'master') as SubAccount;

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  // ... (keep loadData, save, etc.)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          title="Fuel Management"
          subtitle="Track fuel consumption, costs, and variance against expected usage"
          icon={<FuelIcon className="h-6 w-6" />}
          iconColor={portalColor}
          onAdd={() => setModalOpen(true)}
          addLabel="Add Fuel Record"
        />
        <button
          onClick={() => setIsBulkOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
        >
          <Upload className="h-4 w-4 text-slate-500" />
          Bulk Import
        </button>
      </div>

      {/* ... rest of your SubAccountFuel JSX ... */}

      <BulkImportModal
        open={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        tableName="sub_account_fuel"
        portalColor={portalColor}
        subAccount={subAccount}
        sampleColumns={['refuel_date', 'trailer_number', 'expected_litres', 'actual_litres', 'cost_per_litre', 'total_cost', 'trips_since_refuel', 'notes']}
        onSuccess={loadData}
      />
    </div>
  );
}
