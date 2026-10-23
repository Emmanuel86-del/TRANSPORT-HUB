import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { RotateCw, ShieldAlert, Truck, X } from 'lucide-react';

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

export function TyresPage({ color, subAccountFilter }: { color: string; subAccountFilter?: string }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'inventory' | 'retired'>('active');
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rotatingVehicle, setRotatingVehicle] = useState<Vehicle | null>(null);
  const [rotationMap, setRotationMap] = useState<Record<string, string>>({});

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

  const handleOpenRotateModal = (vehicle: Vehicle) => {
    setRotatingVehicle(vehicle);
    const truckTyres = tyres.filter(t => t.vehicle_id === vehicle.id);
    const initialMap: Record<string, string> = {};
    truckTyres.forEach(t => {
      initialMap[t.id] = t.position;
    });
    setRotationMap(initialMap);
  };

  const handleSaveRotation = async () => {
    if (!rotatingVehicle) return;
    try {
      const truckTyres = tyres.filter(t => t.vehicle_id === rotatingVehicle.id);
      const updates = [];
      const historyInserts = [];

      for (const tyre of truckTyres) {
        const newPos = rotationMap[tyre.id];
        if (newPos && newPos !== tyre.position) {
          updates.push(
            supabase.from('tyres').update({ position: newPos }).eq('id', tyre.id)
          );
          historyInserts.push({
            tyre_id: tyre.id,
            vehicle_id: rotatingVehicle.id,
            action: 'rotated',
            position: newPos,
            date: new Date().toISOString(),
            sub_account: rotatingVehicle.sub_account,
          });
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        if (historyInserts.length > 0) {
          await supabase.from('tyre_history').insert(historyInserts);
        }
        showToast('Tyres rotated successfully', 'success');
        setRotatingVehicle(null);
        loadData();
      } else {
        showToast('No position changes detected', 'info');
        setRotatingVehicle(null);
      }
    } catch (err) {
      console.error('Error saving tyre rotation:', err);
      showToast('Failed to save rotation', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tyre Management"
        subtitle="Track active tyres, inventory, and rotations"
        icon={<RotateCw className="h-6 w-6" />}
        iconColor={color}
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
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
                  <button
                    onClick={() => handleOpenRotateModal(vehicle)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-sm"
                    style={{ background: color }}
                  >
                    <RotateCw className="h-3.5 w-3.5" /> Rotate Tyres
                  </button>
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

      {/* Rotate Modal */}
      {rotatingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Rotate Tyres · {rotatingVehicle.plate_number}</h3>
              <button onClick={() => setRotatingVehicle(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tyres.filter(t => t.vehicle_id === rotatingVehicle.id).map(tyre => (
                <div key={tyre.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                  <div>
                    <div className="font-bold text-sm text-slate-800">{tyre.serial_number}</div>
                    <div className="text-xs text-slate-500">Current: {tyre.position}</div>
                  </div>
                  <select
                    value={rotationMap[tyre.id] || tyre.position}
                    onChange={e => setRotationMap({ ...rotationMap, [tyre.id]: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none"
                  >
                    {TYRE_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setRotatingVehicle(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancel
              </button>
              <button onClick={handleSaveRotation} className="px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm" style={{ background: color }}>
                Save Rotation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
