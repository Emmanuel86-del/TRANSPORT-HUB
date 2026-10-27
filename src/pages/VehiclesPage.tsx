import { useState, useEffect, useCallback } from 'react';
import { Truck as TruckIcon, Plus, Search, Edit, Trash2, CheckCircle, XCircle, Upload } from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { SubAccount } from '@/lib/portals';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { PageHeader } from '@/components/PageHeader';
import { BulkImportModal } from '@/components/BulkImportModal';

interface Vehicle {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  status: string;
  sub_account: string;
}

export function VehiclesPage({ portalColor = '#0f172a', isMaster = false }: { portalColor?: string; isMaster?: boolean }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const subAccount = (profile?.sub_account ?? getSubAccountFilter() ?? 'mcl') as SubAccount;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form State for Adding / Updating
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [status, setStatus] = useState<string>('active');

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('vehicles').select('*').order('plate_number', { ascending: true });
    if (!isMaster && subAccount !== 'master') {
      query = query.eq('sub_account', subAccount);
    }
    const { data, error } = await query;
    if (error) {
      showToast('Failed to load trucks/vehicles', 'error');
    } else {
      setVehicles(data || []);
    }
    setLoading(false);
  }, [subAccount, isMaster, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAddModal = () => {
    setEditingVehicle(null);
    setPlateNumber('');
    setMake('');
    setModel('');
    setYear('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setPlateNumber(vehicle.plate_number || '');
    setMake(vehicle.make || '');
    setModel(vehicle.model || '');
    setYear(vehicle.year || '');
    setStatus(vehicle.status || 'active');
    setIsModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim()) {
      showToast('Plate number is required', 'error');
      return;
    }

    const payload = {
      plate_number: plateNumber.toUpperCase(),
      make,
      model,
      year: year ? Number(year) : null,
      status,
      sub_account: subAccount === 'master' ? 'mcl' : subAccount,
    };

    if (editingVehicle) {
      // Update existing record in Supabase
      const { error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicle.id);
      if (error) {
        showToast('Failed to update truck: ' + error.message, 'error');
      } else {
        showToast('Truck updated successfully', 'success');
        setIsModalOpen(false);
        loadData();
      }
    } else {
      // Insert new record into Supabase
      const { error } = await supabase.from('vehicles').insert([payload]);
      if (error) {
        showToast('Failed to add truck: ' + error.message, 'error');
      } else {
        showToast('Truck added successfully', 'success');
        setIsModalOpen(false);
        loadData();
      }
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this truck?')) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) {
      showToast('Failed to delete truck', 'error');
    } else {
      showToast('Truck deleted', 'success');
      loadData();
    }
  };

  const filteredVehicles = vehicles.filter(v =>
    v.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.model?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingSpinner message="Loading trucks and vehicles..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Trucks / Vehicles Management"
          subtitle="Manage your fleet trucks, plate numbers, makes, models, and operational status"
          icon={<TruckIcon className="h-6 w-6" />}
          iconColor={portalColor}
        />

        {/* Action Buttons: Bulk Import & Add Truck */}
        <div className="flex items-center gap-2">
          {!isMaster && (
            <button
              onClick={() => setIsBulkOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
            >
              <Upload className="h-4 w-4 text-slate-500" />
              Bulk Import
            </button>
          )}
          {!isMaster && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm transition-opacity hover:opacity-90"
              style={{ background: portalColor }}
            >
              <Plus className="h-4 w-4" />
              Add Truck
            </button>
          )}
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="card p-4 flex items-center gap-3">
        <Search className="h-5 w-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by plate number, make, or model..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-sm outline-none text-slate-800 placeholder-slate-400"
        />
      </div>

      {/* Vehicles Table */}
      {filteredVehicles.length === 0 ? (
        <div className="card py-12">
          <EmptyState icon={<TruckIcon className="h-8 w-8" />} title="No trucks/vehicles found" message="Get started by adding your first fleet truck or importing via CSV." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Plate Number</th>
                  <th className="px-5 py-3">Make & Model</th>
                  <th className="px-5 py-3">Year</th>
                  <th className="px-5 py-3">Sub-Account</th>
                  <th className="px-5 py-3">Status</th>
                  {!isMaster && <th className="px-5 py-3 text-right">Actions (Update / Delete)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredVehicles.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <TruckIcon className="h-4 w-4" />
                      </div>
                      {v.plate_number}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">
                      {v.make || '—'} {v.model ? `(${v.model})` : ''}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{v.year || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600 uppercase text-xs font-semibold">{v.sub_account || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        v.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {v.status === 'active' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {v.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {!isMaster && (
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {/* Update Button */}
                        <button 
                          onClick={() => handleOpenEditModal(v)} 
                          title="Update Truck"
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {/* Delete Button */}
                        <button 
                          onClick={() => handleDeleteVehicle(v.id)} 
                          title="Delete Truck"
                          className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Update Modal */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingVehicle ? 'Update Truck Details' : 'Register New Truck'}>
        <form onSubmit={handleSaveVehicle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Plate Number *</label>
            <input type="text" required className="input" placeholder="e.g. KAA 123A" value={plateNumber} onChange={e => setPlateNumber(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Make</label>
              <input type="text" className="input" placeholder="e.g. Isuzu, Scania" value={make} onChange={e => setMake(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
              <input type="text" className="input" placeholder="e.g. Giga, P410" value={model} onChange={e => setModel(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <input type="number" className="input" placeholder="e.g. 2020" value={year} onChange={e => setYear(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm" style={{ background: portalColor }}>
              {editingVehicle ? 'Save Updates' : 'Save Truck'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Bulk Import Modal with Template Download & Local File Upload */}
      <BulkImportModal
        open={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        tableName="vehicles"
        portalColor={portalColor}
        subAccount={subAccount}
        sampleColumns={['plate_number', 'make', 'model', 'year', 'status']}
        onSuccess={loadData}
      />
    </div>
  );
}
