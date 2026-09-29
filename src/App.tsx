import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Route, Truck, Users, UserCog, Package, Wrench,
  Calculator, ClipboardList, Scale, FileText, Wallet,
  Menu, X, LogOut, Shield, Briefcase, Truck as TruckIcon, ShieldCheck, UserCheck,
} from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AuthPage } from '@/pages/AuthPage';
import { Dashboard } from '@/pages/Dashboard';
import { Trips } from '@/pages/Trips';
import { Vehicles } from '@/pages/Vehicles';
import { FleetCompliance } from '@/pages/FleetCompliance';
import { Drivers } from '@/pages/Drivers';
import { DriverCompliance } from '@/pages/DriverCompliance';
import { Products } from '@/pages/Products';
import { SpareParts } from '@/pages/SpareParts';
import { WorkRecords } from '@/pages/WorkRecords';
import { Staff } from '@/pages/Staff';
import { RateMatrix } from '@/pages/RateMatrix';
import { DailyDispatch } from '@/pages/DailyDispatch';
import { Weighbridge } from '@/pages/Weighbridge';
import { ClientDeliveries } from '@/pages/ClientDeliveries';
import { Payroll } from '@/pages/Payroll';
import { LoadingSpinner } from '@/components/Shared';
import { UserRole, hasAccess } from '@/types';

type Page = 'dashboard' | 'trips' | 'daily-dispatch' | 'vehicles' | 'fleet-compliance' | 'drivers' | 'driver-compliance' | 'staff' | 'rate-matrix' | 'weighbridge' | 'client-deliveries' | 'payroll' | 'products' | 'spare-parts' | 'work-records';

type NavItem = { id: Page; label: string; icon: React.ReactNode; minRole: UserRole };

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, minRole: 'employee' },
  { id: 'trips', label: 'Trips', icon: <Route className="h-5 w-5" />, minRole: 'employee' },
  { id: 'daily-dispatch', label: 'Daily Dispatch', icon: <ClipboardList className="h-5 w-5" />, minRole: 'employee' },
  { id: 'vehicles', label: 'Fleet Vehicles', icon: <Truck className="h-5 w-5" />, minRole: 'employee' },
  { id: 'fleet-compliance', label: 'Fleet Compliance', icon: <ShieldCheck className="h-5 w-5" />, minRole: 'employee' },
  { id: 'drivers', label: 'Drivers', icon: <Users className="h-5 w-5" />, minRole: 'employee' },
  { id: 'driver-compliance', label: 'Driver Compliance', icon: <UserCheck className="h-5 w-5" />, minRole: 'employee' },
  { id: 'weighbridge', label: 'Weighbridge', icon: <Scale className="h-5 w-5" />, minRole: 'employee' },
  { id: 'products', label: 'Products', icon: <Package className="h-5 w-5" />, minRole: 'employee' },
  { id: 'spare-parts', label: 'Spare Parts', icon: <Wrench className="h-5 w-5" />, minRole: 'employee' },
  { id: 'work-records', label: 'Work Records', icon: <Wrench className="h-5 w-5" />, minRole: 'employee' },
  { id: 'staff', label: 'Staff', icon: <UserCog className="h-5 w-5" />, minRole: 'manager' },
  { id: 'client-deliveries', label: 'Client Deliveries', icon: <FileText className="h-5 w-5" />, minRole: 'manager' },
  { id: 'rate-matrix', label: 'Rate Matrix', icon: <Calculator className="h-5 w-5" />, minRole: 'corporate_admin' },
  { id: 'payroll', label: 'Payroll', icon: <Wallet className="h-5 w-5" />, minRole: 'corporate_admin' },
];

const roleIcon = (role: UserRole) => {
  switch (role) {
    case 'corporate_admin': return <Shield className="h-4 w-4" />;
    case 'manager': return <Briefcase className="h-4 w-4" />;
    default: return <UserCog className="h-4 w-4" />;
  }
};

const roleLabel = (role: UserRole) => {
  switch (role) {
    case 'corporate_admin': return 'Corporate Admin';
    case 'manager': return 'Manager';
    default: return 'Employee';
  }
};

function AppContent() {
  const { user, profile, loading, authError, signOut, retry } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Read initial page from URL hash or default to 'dashboard'
  const getPageFromHash = (): Page => {
    const hash = window.location.hash.replace('#/', '') as Page;
    const validPages = navItems.map(i => i.id);
    return validPages.includes(hash) ? hash : 'dashboard';
  };

  const [page, setPage] = useState<Page>(getPageFromHash);

  // Listen to browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      setPage(getPageFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner message="Loading..." />
        {authError && (
          <div className="max-w-sm rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-center">
            <p className="text-sm text-red-600 mb-2">{authError}</p>
            <button onClick={() => retry()} className="text-sm font-medium text-red-700 hover:text-red-800">Retry</button>
          </div>
        )}
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthPage />;
  }

  const userRole = profile.role;
  const visibleNav = navItems.filter(item => hasAccess(userRole, item.minRole));
  const canAccess = (minRole: UserRole) => hasAccess(userRole, minRole);

  const navigate = (p: Page) => {
    window.location.hash = `#/${p}`;
    setPage(p);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <TruckIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Suraj Ashok Limited</h1>
              <p className="text-xs text-slate-400">Fleet Management</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${userRole === 'corporate_admin' ? 'bg-blue-600 text-white' : userRole === 'manager' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
              {roleIcon(userRole)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200 truncate">{profile.full_name || profile.email}</p>
              <p className="text-xs text-slate-500">{roleLabel(userRole)}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                page === item.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              {item.icon}
              {item.label}
              {item.minRole === 'corporate_admin' && <Shield className="h-3 w-3 ml-auto text-slate-500" />}
              {item.minRole === 'manager' && <Briefcase className="h-3 w-3 ml-auto text-slate-500" />}
            </button>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-slate-800">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <TruckIcon className="h-5 w-5" />
            </div>
            <span className="font-bold text-slate-900">Suraj Ashok Limited</span>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {page === 'dashboard' && <Dashboard />}
          {page === 'trips' && <Trips />}
          {page === 'daily-dispatch' && <DailyDispatch />}
          {page === 'vehicles' && <Vehicles />}
          {page === 'fleet-compliance' && <FleetCompliance />}
          {page === 'drivers' && <Drivers />}
          {page === 'driver-compliance' && <DriverCompliance />}
          {page === 'staff' && canAccess('manager') && <Staff />}
          {page === 'rate-matrix' && canAccess('corporate_admin') && <RateMatrix />}
          {page === 'weighbridge' && <Weighbridge />}
          {page === 'client-deliveries' && canAccess('manager') && <ClientDeliveries />}
          {page === 'payroll' && canAccess('corporate_admin') && <Payroll />}
          {page === 'products' && <Products />}
          {page === 'spare-parts' && <SpareParts />}
          {page === 'work-records' && <WorkRecords />}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthAuthProvider>
  );
}

export default App;
