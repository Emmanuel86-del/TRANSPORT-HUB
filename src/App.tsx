import { useState } from 'react';
import {
  LayoutDashboard, Route, Truck, Users, UserCog, Package, Wrench,
  Calculator, ClipboardList,
  Menu, X, Truck as TruckIcon,
} from 'lucide-react';
import { Dashboard } from '@/pages/Dashboard';
import { Trips } from '@/pages/Trips';
import { Vehicles } from '@/pages/Vehicles';
import { Drivers } from '@/pages/Drivers';
import { Products } from '@/pages/Products';
import { SpareParts } from '@/pages/SpareParts';
import { WorkRecords } from '@/pages/WorkRecords';
import { Staff } from '@/pages/Staff';
import { RateMatrix } from '@/pages/RateMatrix';
import { DailyDispatch } from '@/pages/DailyDispatch';

type Page = 'dashboard' | 'trips' | 'daily-dispatch' | 'vehicles' | 'drivers' | 'staff' | 'rate-matrix' | 'products' | 'spare-parts' | 'work-records';

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'trips', label: 'Trips', icon: <Route className="h-5 w-5" /> },
  { id: 'daily-dispatch', label: 'Daily Dispatch', icon: <ClipboardList className="h-5 w-5" /> },
  { id: 'vehicles', label: 'Fleet', icon: <Truck className="h-5 w-5" /> },
  { id: 'drivers', label: 'Drivers', icon: <Users className="h-5 w-5" /> },
  { id: 'staff', label: 'Staff', icon: <UserCog className="h-5 w-5" /> },
  { id: 'rate-matrix', label: 'Rate Matrix', icon: <Calculator className="h-5 w-5" /> },
  { id: 'products', label: 'Products', icon: <Package className="h-5 w-5" /> },
  { id: 'spare-parts', label: 'Spare Parts', icon: <Wrench className="h-5 w-5" /> },
  { id: 'work-records', label: 'Work Records', icon: <Wrench className="h-5 w-5" /> },
];

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
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
              <h1 className="text-base font-bold tracking-tight">TransportHub</h1>
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

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
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
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">Transport Operations System</p>
          <p className="text-xs text-slate-600 mt-1">v1.0 · September 2026</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
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
            <span className="font-bold text-slate-900">TransportHub</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {page === 'dashboard' && <Dashboard />}
          {page === 'trips' && <Trips />}
          {page === 'daily-dispatch' && <DailyDispatch />}
          {page === 'vehicles' && <Vehicles />}
          {page === 'drivers' && <Drivers />}
          {page === 'staff' && <Staff />}
          {page === 'rate-matrix' && <RateMatrix />}
          {page === 'products' && <Products />}
          {page === 'spare-parts' && <SpareParts />}
          {page === 'work-records' && <WorkRecords />}
        </main>
      </div>
    </div>
  );
}

export default App;
