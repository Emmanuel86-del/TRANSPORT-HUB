import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Phone, CreditCard, Award, CheckCircle, XCircle, Trash2, Edit, Shield, Upload } from 'lucide-react';
import { supabase, getSubAccountFilter } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { SubAccount } from '@/lib/portals';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState } from '@/components/Shared';
import { Driver } from '@/types';
import { BulkImportModal } from '@/components/BulkImportModal';

export function DriversPage({ portalColor, isMaster }: { portalColor: string; isMaster?: boolean }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const subAccount = (profile?.sub_account ?? getSubAccountFilter() ?? 'mcl') as SubAccount;

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [nssfNumber, setNssfNumber] = useState('');
  const [shaNumber, setShaNumber] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('drivers').select('*').order('name', { ascending: true });
    if (!isMaster && subAccount !== 'master') {
      query = query.eq('sub_account', subAccount);
    }
    const { data, error } = await query;
    if (error) {
      showToast('Failed to load drivers', 'error');
    } else {
      setDrivers(data || []);
    }
    setLoading(false);
  }, [subAccount, isMaster, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAddModal = () => {
    setEditingDriver(null);
    setName('');
    setPhone('');
    setIdNumber('');
    setLicenseNumber('');
    setNssfNumber('');
    setShaNumber('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setName(driver.name || '');
    setPhone(driver.phone || '');
    setIdNumber(driver.id_number || '');
    setLicenseNumber(driver.license_number || '');
    setNssfNumber((driver as any).nssf_number || '');
    setShaNumber((driver as any).sha_number || '');
    setStatus(driver.status || 'active');
    setIsModalOpen(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Driver name is required', 'error');
      return;
    }

    const payload = {
      name,
      phone,
      id_number: idNumber,
      license_number: licenseNumber,
      nssf_number: nssfNumber,
      sha_number: shaNumber,
      status,
      sub_account: isMaster ? subAccount : subAccount,
    };

    if (editingDriver) {
      const { error } = await supabase.from('drivers').update(payload).eq('id', editingDriver.id);
      if (error) {
        showToast('Failed to update driver: ' + error.message, 'error');
      } else {
        showToast('Driver updated successfully', 'success');
        setIsModalOpen(false);
        loadData();
      }
    } else {
      const { error } = await supabase.from('drivers').insert([payload]);
      if (error) {
        showToast('Failed to add driver: ' + error.message, 'error');
      } else {
        showToast('Driver added successfully', 'success');
        setIsModalOpen(false);
        loadData();
      }
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) {
      showToast('Failed to delete driver', 'error');
    } else {
      showToast('Driver deleted', 'success');
      loadData();
    }
  };

  const filteredDrivers = drivers.filter(d => {
    const driverAny = d as any;
    return (
      d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.license_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driverAny.nssf_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driverAny.sha_number?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (loading) return <LoadingSpinner message="Loading drivers..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: portalColor }}>
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Drivers Management</h1>
            <p className="text-sm text-slate-500">Manage fleet drivers, licenses, NSSF, SHA, and contact information</p>
          </div>
        </div>

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
              Add Driver
            </button>
          )}
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="card p-4 flex items-center gap-3">
        <Search className="h-5 w-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by name, phone, license, NSSF, or SHA..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-sm outline-none text-slate-800 placeholder-slate-400"
        />
      </div>

      {/* Drivers Table / Grid */}
      {filteredDrivers.length === 0 ? (
        <div className="card py-12">
          <EmptyState icon={<Users className="h-8 w-8" />} title="No drivers found" message="Get started by adding your first fleet driver." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Driver Name</th>
                  <th className="px-5 py-3">Phone Number</th>
                  <th className="px-5 py-3">ID / License</th>
                  <th className="px-5 py-3">NSSF & SHA</th>
                  <th className="px-5 py-3">Status</th>
                  {!isMaster && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredDrivers.map(d => {
                  const driverAny = d as any;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900 flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                          {d.name?.substring(0, 2).toUpperCase()}
                        </div>
                        {d.name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 flex items-center gap-1.5 pt-4">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {d.phone || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <CreditCard className="h-3 w-3 text-slate-400" /> ID: {d.id_number || '—'}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Award className="h-3 w-3 text-slate-400" /> Lic: {d.license_number || '—'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Shield className="h-3 w-3 text-blue-500" /> NSSF: {driverAny.nssf_number || '—'}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Shield className="h-3 w-3 text-emerald-500" /> SHA: {driverAny.sha_number || '—'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          d.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {d.status === 'active' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {d.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {!isMaster && (
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <button onClick={() => handleOpenEditModal(d)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteDriver(d.id)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingDriver ? 'Edit Driver Details' : 'Add New Driver'}>
        <form onSubmit={handleSaveDriver} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
            <input type="text" required className="input" placeholder="e.g. John Kamau" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
            <input type="text" className="input" placeholder="e.g. +254 712 345678" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">National ID Number</label>
              <input type="text" className="input" placeholder="ID Number" value={idNumber} onChange={e => setIdNumber(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">License Number</label>
              <input type="text" className="input" placeholder="Driver License" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">NSSF Number</label>
              <input type="text" className="input" placeholder="NSSF No." value={nssfNumber} onChange={e => setNssfNumber(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SHA Number</label>
              <input type="text" className="input" placeholder="SHA No." value={shaNumber} onChange={e => setShaNumber(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm" style={{ background: portalColor }}>
              {editingDriver ? 'Save Changes' : 'Register Driver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <BulkImportModal
        open={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        tableName="drivers"
        portalColor={portalColor}
        subAccount={subAccount}
        sampleColumns={['name', 'phone', 'id_number', 'license_number', 'nssf_number', 'sha_number', 'status']}
        onSuccess={loadData}
      />
    </div>
  );
}
