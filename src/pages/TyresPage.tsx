import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { RotateCw, Truck, X, Download, Upload } from 'lucide-react';
import { downloadExcelTemplate } from '@/lib/excelTemplates';
import { UploadModal } from '@/components/UploadModal';

type Tyre = {
  id: string;
  serial_number: string;
  vehicle_id: string | null;
  position: string;
  status: string;
  sub_account: string;
  cost: number;
  total_km: number;
};

type Vehicle = {
  id: string;
  plate_number: string;
  sub_account: string;
};

const TYRE_POSITIONS = [
  'Front Left',
  'Front Right',
  'Rear Left Inner',
  'Rear Left Outer',
  'Rear Right Inner',
  'Rear Right Outer',
  'Spare',
];

export function TyresPage({ color, subAccountFilter, isMaster = false }: { color: string; subAccountFilter?: string; isMaster?: boolean }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'inventory' | 'retired'>('active');
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rotatingVehicle, setRotatingVehicle] = useState<Vehicle | null>(null);
  const [rotationMap, setRotationMap] = useState<Record<string, string>>({});
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const effectiveFilter = subAccountFilter ?? (profile?.sub_account === 'master' ? 'all' : profile?.sub_account ?? 'all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let tyreQuery = supabase.from('tyres').select('*');
      let vehicleQuery = supabase.from('vehicles').select('*');

      if (effectiveFilter !== 'all') {
        tyreQuery = tyreQuery.eq('sub_account', effectiveFilter);
        vehicleQuery = vehicleQuery.eq('sub_account', effectiveFilter);
      }

      const [tyreRes, vehicleRes] = await Promise.all([tyreQuery, vehicleQuery]);
      setTyres(tyreRes.data || []);
      setVehicles(vehicleRes.data || []);
    } catch (err) {
      console.error('Error loading tyres:', err);
      showToast('Failed to load tyre data', 'error');
    } finally {
      setLoading(false);
    }
  }, [effectiveFilter, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tyre Management"
        subtitle={isMaster ? 'Master monitoring view — tracking active tyres and rotations across sub-accounts' : 'Track active tyres, inventory, and rotations'}
        icon={<RotateCw className="h-6 w-6" />}
        iconColor={color}
      />

      {/* Tabs & Action Buttons (Hidden upload/rotate buttons for Master) */}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadExcelTemplate('tyres')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" /> Download Template
          </button>
          {!isMaster && (
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm"
              style={{ background: color }}
            >
              <Upload className="h-3.5 w-3.5" /> Upload Tyres
            </button>
          )}
        </div>
      </div>

      {activeTab === 'active' && (
        <div className="space-y-4">
          {vehicles.map(vehicle => {
            const truckTyres = tyres.filter(t => t.vehicle_id === vehicle.id);
            if (truckTyres.length === 0) return null;

            return (
              <div key={vehicle.id} className="card p-5 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5" style={{ color }} />
                    <h3 className="font-bold text-slate-800">{vehicle.plate_number}</h3>
                  </div>
                  {!isMaster && (
                    <button
                      onClick={() => {
                        setRotatingVehicle(vehicle);
                        const initialMap: Record<string, string> = {};
                        truckTyres.forEach(t => { initialMap[t.id] = t.position; });
                        setRotationMap(initialMap);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-sm"
                      style={{ background: color }}
                    >
                      <RotateCw className="h-3.5 w-3.5" /> Rotate Tyres
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {truckTyres.map(t => (
                    <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                      <div className="font-bold text-slate-900">{t.serial_number}</div>
                      <div className="text-slate-500">Pos: {t.position}</div>
                      <div className="text-slate-500">KM: {t.total_km || 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        tableName="tyres"
        subAccount={effectiveFilter === 'all' ? 'mcl' : effectiveFilter}
        onSuccess={loadData}
      />
    </div>
  );
}
