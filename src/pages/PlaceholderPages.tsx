import { ReactNode } from 'react';
import * as Icons from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/lib/auth';
import { portalLabel } from '@/lib/portals';

type IconName = keyof typeof Icons;

export function PlaceholderPage({
  title,
  subtitle,
  iconName = 'Construction',
  iconColor,
}: {
  title: string;
  subtitle: string;
  iconName?: string;
  iconColor?: string;
}) {
  const { profile } = useAuth();
  const Icon = (Icons[iconName as IconName] || Icons.Construction) as Icons.LucideIcon;
  const sa = profile?.sub_account ?? 'master';

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={<Icon className="h-6 w-6" />}
        iconColor={iconColor}
      />
      <div className="card flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-700 mb-1">{title} — Coming Soon</h3>
        <p className="max-w-sm text-sm text-slate-500">
          This module is being built for {portalLabel(sa)}. Data and forms will appear here once available.
        </p>
      </div>
    </div>
  );
}

export function LiveMonitorPage({ color }: { color: string }) {
  return <PlaceholderPage title="Live Monitor" subtitle="Real-time fleet tracking and status" iconName="Activity" iconColor={color} />;
}

export function FuelPage({ color }: { color: string }) {
  return <PlaceholderPage title="Fuel Management" subtitle="Track fuel consumption and costs" iconName="Fuel" iconColor={color} />;
}

export function TalliesPage({ color }: { color: string }) {
  return <PlaceholderPage title="Tallies" subtitle="Daily tally records and summaries" iconName="Calculator" iconColor={color} />;
}

export function ReportsPage({ color }: { color: string }) {
  return <PlaceholderPage title="Reports" subtitle="Generate and export operational reports" iconName="FileText" iconColor={color} />;
}

export function OverviewPage({ color }: { color: string }) {
  return <PlaceholderPage title="Overview" subtitle="Company-wide overview across all sub-accounts" iconName="LayoutDashboard" iconColor={color} />;
}

export function CompliancePage({ color }: { color: string }) {
  return <PlaceholderPage title="Compliance" subtitle="Fleet and driver compliance across all sub-accounts" iconName="ShieldCheck" iconColor={color} />;
}

export function SubAccountViewPage({ color, name }: { color: string; name: string }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={name}
        subtitle="Sub-account dashboard and operations"
        icon={<Icons.Building2 className="h-6 w-6" />}
        iconColor={color}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Vehicles', value: '—', icon: 'Truck' },
          { label: 'Active Drivers', value: '—', icon: 'Users' },
          { label: 'Trips Today', value: '—', icon: 'Route' },
          { label: 'Open Issues', value: '—', icon: 'AlertTriangle' },
        ].map(stat => {
          const Icon = (Icons[stat.icon as IconName] || Icons.Circle) as Icons.LucideIcon;
          return (
            <div key={stat.label} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-700">{stat.value}</p>
            </div>
          );
        })}
      </div>
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
          <Icons.Building2 className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-700 mb-1">{name} Dashboard</h3>
        <p className="max-w-sm text-sm text-slate-500">
          Full sub-account dashboard with live data will be available here.
        </p>
      </div>
    </div>
  );
}
