import { useState, useMemo, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, CheckCircle, ChevronRight } from 'lucide-react';
import { SubAccount, PORTALS } from '@/lib/portals';
import { supabase } from '@/lib/supabase';
import {
getLastWeekRange, getCurrentWeekRange, isSaturday, fmtDate, toISODate,
isWeeklyReviewed, markWeeklyReviewed, ReportData, ReportFilters,
} from '@/lib/report-utils';
import { generateReportPDF, generateCombinedReportPDF } from '@/lib/report-pdf';
import { Modal } from '@/components/Modal';
import { LoadingSpinner } from '@/components/Shared';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth';

const SUB_ACCOUNTS: SubAccount[] = ['mcl', 'tarmal', 'csl', 'mushroom'];

export function MasterReportsPage({ portalColor }: { portalColor: string }) {
const { showToast } = useToast();
const { profile } = useAuth();

const lastWeek = useMemo(() => getLastWeekRange(), []);
const currentWeek = useMemo(() => getCurrentWeekRange(), []);
const saturday = isSaturday();

const [activeSubAccount, setActiveSubAccount] = useState('mcl');
const [fromDate, setFromDate] = useState(toISODate(lastWeek.start));
const [toDate, setToDate] = useState(toISODate(lastWeek.end));
const [weeklyModalOpen, setWeeklyModalOpen] = useState(false);
const [downloading, setDownloading] = useState(false);
const [downloadingAll, setDownloadingAll] = useState(false);
const [allReviewed, setAllReviewed] = useState<Record<string, boolean>>(() => {
const m: Record<string, boolean> = {};
SUB_ACCOUNTS.forEach(sa => { m[sa] = isWeeklyReviewed(sa); });
return m;
});

const periodLabel = ${fmtDate(new Date(fromDate))} → ${fmtDate(new Date(toDate))};

const [reportData, setReportData] = useState<Record<string, ReportData | null>>({});
const [tyresData, setTyresData] = useState<Record<string, any[]>>({});
const [loading, setLoading] = useState(true);

const loadAllData = useCallback(async () => {
setLoading(true);
const results: Record<string, ReportData | null> = {};
const tyresResults: Record<string, any[]> = {};

for (const sa of SUB_ACCOUNTS) {
  const from = fromDate;
  const to = toDate;

  const [trips, fuel, tallies, parts, containers, vc, dc, vehicles, drivers, tyres] = await Promise.all([
    supabase.from('sub_account_trips').select('*, vehicle:vehicles(plate_number, make, model), driver:drivers(name)').gte('trip_date', from).lte('trip_date', to).eq('sub_account', sa).order('trip_date', { ascending: false }),
    supabase.from('sub_account_fuel').select('*, vehicle:vehicles(plate_number), driver:drivers(name)').gte('refuel_date', from).lte('refuel_date', to).eq('sub_account', sa).order('refuel_date', { ascending: false }),
    supabase.from('sub_account_tallies').select('*, vehicle:vehicles(plate_number)').gte('tally_date', from).lte('tally_date', to).eq('sub_account', sa).order('tally_date', { ascending: false }),
    supabase.from('spare_parts_v2').select('*, vehicle:vehicles(plate_number)').eq('sub_account', sa).order('created_at', { ascending: false }),
    supabase.from('sub_account_containers').select('*, vehicle:vehicles(plate_number)').eq('sub_account', sa).order('created_at', { ascending: false }),
    supabase.from('vehicle_compliance_items').select('*, vehicle:vehicles(plate_number)').eq('sub_account', sa).order('expiry_date', { ascending: true, nullsFirst: false }),
    supabase.from('driver_compliance_items').select('*, driver:drivers(name)').eq('sub_account', sa).order('expiry_date', { ascending: true, nullsFirst: false }),
    supabase.from('vehicles').select('id, plate_number, make, model').eq('sub_account', sa).order('plate_number'),
    supabase.from('drivers').select('id, name').eq('sub_account', sa).order('name'),
    supabase.from('tyres').select('*, vehicle:vehicles(plate_number)').eq('sub_account', sa),
  ]);

  results[sa] = {
    trips: trips.data || [],
    fuel: fuel.data || [],
    tallies: tallies.data || [],
    spareParts: parts.data || [],
    containers: containers.data || [],
    vehicleCompliance: vc.data || [],
    driverCompliance: dc.data || [],
    vehicles: vehicles.data || [],
    drivers: drivers.data || [],
  };
  tyresResults[sa] = tyres.data || [];
}
setReportData(results);
setTyresData(tyresResults);
setLoading(false);


}, [fromDate, toDate]);

useEffect(() => { loadAllData(); }, [loadAllData]);

const handleDownloadSub = async (sa: SubAccount) => {
const data = reportData[sa];
if (!data) return;
setDownloading(true);
try {
await generateReportPDF(sa, periodLabel, data);
showToast(${PORTALS[sa].name} report downloaded, 'success');
} catch (err) {
showToast('Failed to generate PDF', 'error');
}
setDownloading(false);
};

const handleDownloadAll = async () => {
setDownloadingAll(true);
try {
const validData: Record<string, ReportData> = {};
for (const sa of SUB_ACCOUNTS) {
if (reportData[sa]) validData[sa] = reportData[sa]!;
}
await generateCombinedReportPDF(SUB_ACCOUNTS, periodLabel, validData);
showToast('Combined report downloaded', 'success');
} catch (err) {
showToast('Failed to generate combined PDF', 'error');
}
setDownloadingAll(false);
};

const handleMarkAllReviewed = () => {
SUB_ACCOUNTS.forEach(sa => markWeeklyReviewed(sa));
const m: Record<string, boolean> = {};
SUB_ACCOUNTS.forEach(sa => { m[sa] = true; });
setAllReviewed(m);
setWeeklyModalOpen(false);
showToast('All weekly reports marked as reviewed', 'success');
};

const allReviewedNow = SUB_ACCOUNTS.every(sa => allReviewed[sa]);

return (

{saturday && !allReviewedNow && (
<div
className="rounded-xl p-4 flex items-center justify-between cursor-pointer transition-opacity hover:opacity-95"
style={{ background: portalColor, color: 'white' }}
onClick={() => setWeeklyModalOpen(true)}
>



Weekly reports ready for all sub-accounts
Covers {lastWeek.label}



View summary



)}

  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: portalColor }}>
        <FileText className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Reports — Master</h1>
        {!saturday && <p className="text-xs text-slate-500">Current week: {currentWeek.label}</p>}
      </div>
    </div>
    <button
      onClick={handleDownloadAll}
      disabled={downloadingAll || loading}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm disabled:opacity-50 transition-opacity hover:opacity-90"
      style={{ background: portalColor }}
    >
      <Download className="h-4 w-4" />
      {downloadingAll ? 'Generating...' : 'Download All (Combined PDF)'}
    </button>
  </div>

  <div className="card p-4 flex flex-col sm:flex-row gap-3">
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
      <input type="date" className="input text-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
    </div>
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
      <input type="date" className="input text-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
    </div>
  </div>

  <div className="flex gap-2 border-b border-slate-200 pb-2">
    {SUB_ACCOUNTS.map(sa => {
      const portal = PORTALS[sa];
      return (
        <button
          key={sa}
          onClick={() => setActiveSubAccount(sa)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeSubAccount === sa ? 'text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
          style={activeSubAccount === sa ? { background: portal.color } : undefined}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: portal.color }} />
          {portal.name}
        </button>
      );
    })}
  </div>

  {loading ? (
    <LoadingSpinner message="Loading report data..." />
  ) : (
    <SubAccountSummary
      subAccount={activeSubAccount}
      data={reportData[activeSubAccount]}
      tyres={tyresData[activeSubAccount] || []}
      periodLabel={periodLabel}
      onDownload={() => handleDownloadSub(activeSubAccount)}
      downloading={downloading}
    />
  )}

  <Modal open={weeklyModalOpen} onClose={() => setWeeklyModalOpen(false)} title={`Weekly Reports — ${lastWeek.label}`} size="lg">
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {SUB_ACCOUNTS.map(sa => {
        const data = reportData[sa];
        if (!data) return null;
        const portal = PORTALS[sa];
        const trips = data.trips.length;
        const fuelCost = data.fuel.reduce((s: number, f: any) => s + Number(f.total_cost || 0), 0);
        const tallage = data.tallies.reduce((s: number, t: any) => s + Number(t.net_tallage || 0), 0);
        const mileage = data.trips.reduce((s: number, t: any) => s + Number(t.mileage_payment || 0), 0);
        const overdue = data.containers.filter((c: any) => c.status === 'active' && c.detention_validity && new Date(c.detention_validity) < new Date()).length;

        return (
          <div key={sa} className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 text-white text-sm font-semibold" style={{ background: portal.color }}>
              {portal.fullName}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3">
              <div><p className="text-xs text-slate-400">Trips</p><p className="text-lg font-bold text-slate-800">{trips}</p></div>
              <div><p className="text-xs text-slate-400">Fuel Cost</p><p className="text-lg font-bold text-slate-800">KES {fuelCost.toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-400">Tallage</p><p className="text-lg font-bold text-slate-800">{tallage.toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-400">Mileage</p><p className="text-lg font-bold text-slate-800">KES {mileage.toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-400">Overdue</p><p className={`text-lg font-bold ${overdue > 0 ? 'text-red-600' : 'text-slate-800'}`}>{overdue}</p></div>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" onChange={handleMarkAllReviewed} className="rounded border-slate-300" />
          Mark all as reviewed
        </label>
        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ background: portalColor }}
        >
          <Download className="h-4 w-4" />
          Download Combined PDF
        </button>
      </div>
    </div>
  </Modal>
</div>


);
}

function SubAccountSummary({
subAccount, data, tyres, periodLabel, onDownload, downloading,
}: {
subAccount: SubAccount;
data: ReportData | null;
tyres: any[];
periodLabel: string;
onDownload: () => void;
downloading: boolean;
}) {
const portal = PORTALS[subAccount];
if (!data) return No data available.;

const trips = data.trips.length;
const fuelCost = data.fuel.reduce((s: number, f: any) => s + Number(f.total_cost || 0), 0);
const tallage = data.tallies.reduce((s: number, t: any) => s + Number(t.net_tallage || 0), 0);
const mileage = data.trips.reduce((s: number, t: any) => s + Number(t.mileage_payment || 0), 0);
const today = new Date(); today.setHours(0, 0, 0, 0);
const overdue = data.containers.filter((c: any) => c.status === 'active' && c.detention_validity && new Date(c.detention_validity) < today).length;

const avgLifecycleKm = tyres.length > 0 ? Math.round(tyres.reduce((s, t) => s + Number(t.total_km || 0), 0) / tyres.length) : 0;
const totalTyreCost = tyres.reduce((s, t) => s + Number(t.cost || 0), 0);

const stats = [
{ label: 'Trips', value: String(trips) },
{ label: 'Fuel Cost', value: KES ${fuelCost.toLocaleString()} },
{ label: 'Net Tallage', value: tallage.toLocaleString() },
{ label: 'Mileage Pay', value: KES ${mileage.toLocaleString()} },
{ label: 'Avg Tyre KM', value: ${avgLifecycleKm.toLocaleString()} KM },
{ label: 'Tyre Cost', value: KES ${totalTyreCost.toLocaleString()} },
];

return (



<span className="h-3 w-3 rounded-full" style={{ background: portal.color }} />
{portal.fullName}
{periodLabel}

<button
onClick={onDownload}
disabled={downloading}
className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50"
style={{ background: portal.color }}
>

Download



{stats.map(s => (

{s.label}
{s.value}

))}


);
}
