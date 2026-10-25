import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { Truck, Plus, Calendar, Fuel, DollarSign, BarChart3 } from 'lucide-react';

export function MCLShaleLimestonePage({ portalColor }: { portalColor: string }) {
  const [activeSubTab, setActiveSubTab] = useState<'trips' | 'fuel' | 'revenue' | 'summary'>('trips');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchVehicles() {
      const { data } = await supabase.from('vehicles').select('*').eq('sub_account', 'mcl');
      if (data) setVehicles(data);
      if (data && data.length > 0) setSelectedVehicle(data[0].plate_number);
    }
    fetchVehicles();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header Banner */}
      <div className="rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4" style={{ background: portalColor }}>
        <div>
          <h1 className="text-xl font-bold">MCL Shale & Limestone Operations</h1>
          <p className="text-xs text-white/80 mt-1">October 2026 Fleet Tonnage, Material Sources & Fuel Allocation Tracker</p>
        </div>
        <div className="flex bg-white/10 p-1 rounded-xl backdrop-blur-sm">
          {[
            { id: 'trips', label: 'Trip & Material Log', icon: Calendar },
            { id: 'fuel', label: 'Fuel Allocation', icon: Fuel },
            { id: 'revenue', label: 'Revenue & Rates', icon: DollarSign },
            { id: 'summary', label: 'Master Summary', icon: BarChart3 },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeSubTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-white hover:bg-white/10'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vehicle Quick Selector */}
      {activeSubTab !== 'summary' && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Select Vehicle Sheet:</span>
            <select
              value={selectedVehicle}
              onChange={e => setSelectedVehicle(e.target.value)}
              className="input text-xs py-1.5 w-48 font-mono"
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.plate_number}>{v.plate_number} ({v.make || '10 Wheeler'})</option>
              ))}
            </select>
          </div>
          <span className="text-xs font-mono text-slate-500">Active Fleet: MCL Sub-Account</span>
        </div>
      )}

      {/* Tab 1: Trip & Material Source Log */}
      {activeSubTab === 'trips' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Daily Trips by Material Source ({selectedVehicle})</h2>
              <p className="text-xs text-slate-500">Record Trips 1 to 13 across sources M, G, N, R, S, T with automatic cumulative tonnage</p>
            </div>
            <button
              onClick={() => showToast('New daily trip row added successfully', 'success')}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              style={{ background: portalColor }}
            >
              <Plus className="h-3.5 w-3.5" /> Add Date Entry
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Trip 1</th>
                  <th className="p-3">Trip 2</th>
                  <th className="p-3">Trip 3</th>
                  <th className="p-3">Trip 4</th>
                  <th className="p-3">Trip 5</th>
                  <th className="p-3">Total Tons</th>
                  <th className="p-3">Cum. Tonnage</th>
                  <th className="p-3">Trips Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">2026-10-01</td>
                  <td className="p-3"><input type="text" placeholder="M (38t)" className="w-20 p-1 border rounded text-center" /></td>
                  <td className="p-3"><input type="text" placeholder="G (35t)" className="w-20 p-1 border rounded text-center" /></td>
                  <td className="p-3"><input type="text" placeholder="N (0t)" className="w-20 p-1 border rounded text-center" /></td>
                  <td className="p-3"><input type="text" placeholder="—" className="w-20 p-1 border rounded text-center" /></td>
                  <td className="p-3"><input type="text" placeholder="—" className="w-20 p-1 border rounded text-center" /></td>
                  <td className="p-3 font-bold text-slate-900">73.00 T</td>
                  <td className="p-3">73.00 T</td>
                  <td className="p-3">2 Trips</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">2026-10-02</td>
                  <td className="p-3"><input type="text" placeholder="M" className="w-20 p-1 border rounded text-center" defaultValue="M (38t)" /></td>
                  <td className="p-3"><input type="text" placeholder="R" className="w-20 p-1 border rounded text-center" defaultValue="R (40t)" /></td>
                  <td className="p-3"><input type="text" placeholder="—" className="w-20 p-1 border rounded text-center" /></td>
                  <td className="p-3"><input type="text" placeholder="—" className="w-20 p-1 border rounded text-center" /></td>
                  <td className="p-3"><input type="text" placeholder="—" className="w-20 p-1 border rounded text-center" /></td>
                  <td className="p-3 font-bold text-slate-900">78.00 T</td>
                  <td className="p-3">151.00 T</td>
                  <td className="p-3">2 Trips</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Fuel Allocation */}
      {activeSubTab === 'fuel' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-800">Fuel Allocation & Balance Tracker ({selectedVehicle})</h2>
            <p className="text-xs text-slate-500">Track planned fuel vs actual fuel consumed, loss/gain variances</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Fuel Added (L)</th>
                  <th className="p-3">Expected Fuel Bal (L)</th>
                  <th className="p-3">Actual Fuel Bal (L)</th>
                  <th className="p-3">Loss (-) / Gain (+)</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">2026-10-01</td>
                  <td className="p-3">40.0 L</td>
                  <td className="p-3">810 L</td>
                  <td className="p-3 text-red-600 font-bold">817 L</td>
                  <td className="p-3 text-red-600 font-bold">-7 L</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold">Variance Over</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">2026-10-02</td>
                  <td className="p-3">50.0 L</td>
                  <td className="p-3">620 L</td>
                  <td className="p-3 text-emerald-600 font-bold">620 L</td>
                  <td className="p-3 text-emerald-600 font-bold">0 L</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">Balanced</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Revenue & Rates */}
      {activeSubTab === 'revenue' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Daily Revenue & Shipping Rate Matrix ({selectedVehicle})</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-medium">Total Monthly Tonnage</div>
              <div className="text-xl font-bold text-slate-900 mt-1">889.26 Tons</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs text-emerald-600 font-medium">Gross Revenue (KES)</div>
              <div className="text-xl font-bold text-emerald-700 mt-1">KES 370,071.60</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-xs text-blue-600 font-medium">Revenue Less Diesel (KES)</div>
              <div className="text-xl font-bold text-blue-700 mt-1">KES 192,880.85</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Master Summary */}
      {activeSubTab === 'summary' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">MCL Fleet Master Summary (October 2026)</h2>
          <p className="text-xs text-slate-500">Aggregated totals across all 10-wheeler limestone & shale trucks.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 uppercase">
                <tr>
                  <th className="p-3 border">Vehicle Reg</th>
                  <th className="p-3 border">Total Tons</th>
                  <th className="p-3 border">Planned Fuel (L)</th>
                  <th className="p-3 border">Actual Fuel (L)</th>
                  <th className="p-3 border">Variance (L)</th>
                  <th className="p-3 border">Gross Revenue (KES)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border font-bold">KDP 417R</td>
                  <td className="p-3 border">889.26</td>
                  <td className="p-3 border">810</td>
                  <td className="p-3 border">817</td>
                  <td className="p-3 border text-red-600">-7</td>
                  <td className="p-3 border">370,071.60</td>
                </tr>
                <tr>
                  <td className="p-3 border font-bold">KDB 987C</td>
                  <td className="p-3 border">1,159.48</td>
                  <td className="p-3 border">1,370</td>
                  <td className="p-3 border">1,370</td>
                  <td className="p-3 border text-emerald-600">0</td>
                  <td className="p-3 border">483,574.80</td>
                </tr>
                <tr>
                  <td className="p-3 border font-bold">KDX 926L</td>
                  <td className="p-3 border">2,873.51</td>
                  <td className="p-3 border">538</td>
                  <td className="p-3 border">484</td>
                  <td className="p-3 border text-emerald-600">+54</td>
                  <td className="p-3 border">434,913.35</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
