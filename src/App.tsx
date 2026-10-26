import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AuthPage } from '@/pages/AuthPage';
import { ToastProvider } from '@/components/Toast';
import { WorkspaceShell } from '@/components/WorkspaceShell';
import { LoadingSpinner } from '@/components/Shared';
import { setSubAccountFilter } from '@/lib/supabase';

// Existing pages
import { Dashboard } from '@/pages/Dashboard';
import { Users } from '@/pages/Users';
import { DriversPage } from '@/pages/DriversPage';

// Sub-account pages
import { SubAccountTrips } from '@/pages/SubAccountTrips';
import { SubAccountTallies } from '@/pages/SubAccountTallies';
import { SubAccountFuel } from '@/pages/SubAccountFuel';
import { SparePartsV2 } from '@/pages/SparePartsV2';
import { TyresPage } from '@/pages/TyresPage';
import { CompliancePageFull } from '@/pages/CompliancePageFull';
import { ContainersPage } from '@/pages/ContainersPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { MasterReportsPage } from '@/pages/MasterReportsPage';

// Placeholder and Monitor pages
import { OverviewPage } from '@/pages/PlaceholderPages';
import { LiveMonitor } from '@/pages/LiveMonitor';

import { portalFromPath, slugFromPath, PORTALS, TabId, SubAccount } from '@/lib/portals';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PageErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 [Page Crash Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-2xl bg-red-50 border border-red-200 text-center max-w-lg mx-auto my-12 shadow-sm">
          <h3 className="text-base font-bold text-red-800 mb-2">Unable to load this section</h3>
          <p className="text-xs text-red-600 mb-4 font-mono bg-red-100/50 p-3 rounded-lg overflow-x-auto text-left">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
          >
            Reload Workspace
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function SubAccountDashboardWrapper({ subAccount, onViewAllContainers, onViewCompliance }: { subAccount: SubAccount; onViewAllContainers: () => void; onViewCompliance: () => void }) {
  useEffect(() => {
    setSubAccountFilter(subAccount);
    return () => {
      setSubAccountFilter('master');
    };
  }, [subAccount]);

  return (
    <Dashboard 
      key={subAccount} 
      onViewAllContainers={onViewAllContainers} 
      onViewCompliance={onViewCompliance} 
    />
  );
}

function AppContent() {
  const { user, profile, loading, authError, retry } = useAuth();
  
  const getInitialTab = (): TabId => {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments[0] === 'admin') {
      return (segments[1] as TabId) || 'overview';
    }
    return (segments[1] as TabId) || 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

  const pathSlug = slugFromPath(window.location.pathname);
  const portal = pathSlug ? (portalFromPath(window.location.pathname) ?? PORTALS.master) : PORTALS.master;

  useEffect(() => {
    if (!pathSlug) {
      window.location.replace('/admin');
    }
  }, [pathSlug]);

  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path === '') {
      window.location.replace('/admin');
    }
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
    return <AuthPage portal={portal} />;
  }

  const isMaster = pathSlug === 'master';

  const renderTabContent = () => {
    if (isMaster) {
      switch (activeTab) {
        case 'live-monitor': return <LiveMonitor color={portal.color} subAccountFilter="all" />;
        case 'overview': return <OverviewPage color={portal.color} />;
        case 'dashboard': return <OverviewPage color={portal.color} />;
        
        case 'mcl': 
          return <SubAccountDashboardWrapper key="mcl" subAccount="mcl" onViewAllContainers={() => setActiveTab('containers')} onViewCompliance={() => setActiveTab('compliance')} />;
        case 'tarmal': 
          return <SubAccountDashboardWrapper key="tarmal" subAccount="tarmal" onViewAllContainers={() => setActiveTab('containers')} onViewCompliance={() => setActiveTab('compliance')} />;
        case 'csl': 
          return <SubAccountDashboardWrapper key="csl" subAccount="csl" onViewAllContainers={() => setActiveTab('containers')} onViewCompliance={() => setActiveTab('compliance')} />;
        case 'mushroom': 
          return <SubAccountDashboardWrapper key="mushroom" subAccount="mushroom" onViewAllContainers={() => setActiveTab('containers')} onViewCompliance={() => setActiveTab('compliance')} />;
        
        case 'users': return <Users />;
        case 'drivers': return <DriversPage portalColor={portal.color} isMaster />;
        case 'spare-parts': return <SparePartsV2 mclArea={null} portalColor={portal.color} isMaster />;
        case 'tyres': return <TyresPage mclArea={null} portalColor={portal.color} isMaster />;
        case 'containers': return <ContainersPage mclArea={null} portalColor={portal.color} isMaster />;
        case 'compliance': return <CompliancePageFull mclArea={null} portalColor={portal.color} isMaster />;
        case 'reports': return <MasterReportsPage portalColor={portal.color} />;
        default: return <OverviewPage color={portal.color} />;
      }
    }

    switch (activeTab) {
      case 'live-monitor': return <LiveMonitor color={portal.color} subAccountFilter={portal.slug} />;
      case 'dashboard': return <Dashboard onViewAllContainers={() => setActiveTab('containers')} onViewCompliance={() => setActiveTab('compliance')} />;
      case 'trips': return <SubAccountTrips mclArea={null} portalColor={portal.color} />;
      case 'fuel': return <SubAccountFuel mclArea={null} portalColor={portal.color} />;
      case 'tallies': return <SubAccountTallies mclArea={null} portalColor={portal.color} />;
      case 'drivers': return <DriversPage portalColor={portal.color} />;
      case 'spare-parts': return <SparePartsV2 mclArea={null} portalColor={portal.color} />;
      case 'tyres': return <TyresPage mclArea={null} portalColor={portal.color} />;
      case 'containers': return <ContainersPage mclArea={null} portalColor={portal.color} />;
      case 'compliance': return profile.role === 'manager' || profile.role === 'corporate_admin'
          ? <CompliancePageFull mclArea={null} portalColor={portal.color} />
          : <div className="flex flex-col items-center justify-center gap-3 py-20 text-center"><p className="text-sm text-slate-500">You need manager access to view compliance records.</p></div>;
      case 'reports': return <ReportsPage mclArea={null} portalColor={portal.color} />;
      default: return <Dashboard onViewAllContainers={() => setActiveTab('containers')} onViewCompliance={() => setActiveTab('compliance')} />;
    }
  };

  return (
    <WorkspaceShell
      portal={portal}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      subAccountSwitcher={isMaster}
    >
      <PageErrorBoundary>
        {renderTabContent()}
      </PageErrorBoundary>
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
