import { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AuthPage } from '@/pages/AuthPage';
import { ToastProvider } from '@/components/Toast';
import { WorkspaceShell } from '@/components/WorkspaceShell';
import { MCLAreaSelection } from '@/components/MCLAreaSelection';
import { LoadingSpinner } from '@/components/Shared';

// Existing pages
import { Dashboard } from '@/pages/Dashboard';
import { Users } from '@/pages/Users';

// New sub-account pages
import { SubAccountTrips } from '@/pages/SubAccountTrips';
import { SubAccountTallies } from '@/pages/SubAccountTallies';
import { SubAccountFuel } from '@/pages/SubAccountFuel';
import { SparePartsV2 } from '@/pages/SparePartsV2';
import { ContainersPage } from '@/pages/ContainersPage';

// Placeholder pages
import {
  LiveMonitorPage, ReportsPage,
  OverviewPage, CompliancePage, SubAccountViewPage,
} from '@/pages/PlaceholderPages';

import { portalFromPath, slugFromPath, PORTALS, TabId, MCLArea } from '@/lib/portals';

function AppContent() {
  const { user, profile, loading, authError, retry } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [mclArea, setMclArea] = useState<MCLArea | null>(null);

  const pathSlug = slugFromPath(window.location.pathname);
  const portal = pathSlug ? (portalFromPath(window.location.pathname) ?? PORTALS.master) : PORTALS.master;

  // Redirect unknown paths to /admin
  useEffect(() => {
    if (!pathSlug) {
      window.location.replace('/admin');
    }
  }, [pathSlug]);

  // Redirect root to /admin
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path === '') {
      window.location.replace('/admin');
    }
  }, []);

  // Reset MCL area selection when portal changes or user signs out
  useEffect(() => {
    if (pathSlug !== 'mcl') {
      setMclArea(null);
    }
  }, [pathSlug]);

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
    return <AuthPage portal={portal} />;
  }

  // MCL: show area selection first
  if (pathSlug === 'mcl' && !mclArea) {
    return <MCLAreaSelection portal={portal} onAreaSelected={(area) => setMclArea(area)} />;
  }

  const isMaster = pathSlug === 'admin';

  const renderTabContent = () => {
    // Master portal tabs
    if (isMaster) {
      switch (activeTab) {
        case 'live-monitor': return <LiveMonitorPage color={portal.color} />;
        case 'overview': return <OverviewPage color={portal.color} />;
        case 'mcl': return <SubAccountViewPage color={PORTALS.mcl.color} name={PORTALS.mcl.fullName} />;
        case 'tarmal': return <SubAccountViewPage color={PORTALS.tarmal.color} name={PORTALS.tarmal.fullName} />;
        case 'csl': return <SubAccountViewPage color={PORTALS.csl.color} name={PORTALS.csl.fullName} />;
        case 'mushroom': return <SubAccountViewPage color={PORTALS.mushroom.color} name={PORTALS.mushroom.fullName} />;
        case 'users': return <Users />;
        case 'spare-parts': return <SparePartsV2 mclArea={null} portalColor={portal.color} isMaster />;
        case 'containers': return <ContainersPage mclArea={null} portalColor={portal.color} />;
        case 'compliance': return <CompliancePage color={portal.color} />;
        case 'reports': return <ReportsPage color={portal.color} />;
        default: return <OverviewPage color={portal.color} />;
      }
    }

    // Sub-account portal tabs
    switch (activeTab) {
      case 'live-monitor': return <LiveMonitorPage color={portal.color} />;
      case 'dashboard': return <Dashboard mclArea={mclArea} onViewAllContainers={() => setActiveTab('containers')} />;
      case 'trips': return <SubAccountTrips mclArea={mclArea} portalColor={portal.color} />;
      case 'fuel': return <SubAccountFuel mclArea={mclArea} portalColor={portal.color} />;
      case 'tallies': return <SubAccountTallies mclArea={mclArea} portalColor={portal.color} />;
      case 'spare-parts': return <SparePartsV2 mclArea={mclArea} portalColor={portal.color} />;
      case 'containers': return <ContainersPage mclArea={mclArea} portalColor={portal.color} />;
      case 'reports': return <ReportsPage color={portal.color} />;
      default: return <Dashboard mclArea={mclArea} onViewAllContainers={() => setActiveTab('containers')} />;
    }
  };

  return (
    <WorkspaceShell
      portal={portal}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      mclArea={mclArea}
      onMCLAreaBack={() => setMclArea(null)}
      subAccountSwitcher={isMaster}
    >
      {renderTabContent()}
    </WorkspaceShell>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
