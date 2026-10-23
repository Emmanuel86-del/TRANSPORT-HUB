import { ReactNode } from 'react';
import * as Icons from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/lib/auth';
import { portalLabel } from '@/lib/portals';
import { LiveMonitor } from './LiveMonitor';

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

export function FuelPage({ color }: { color: string }) {
  return <PlaceholderPage title="Fuel Management" subtitle="Track fuel consumption and costs" iconName="Fuel" iconColor={color} />;
}

export function TalliesPage({ color }: { color: string }) {
  return <PlaceholderPage title="Tallies" subtitle="Daily tally records and summaries" iconName="Calculator" iconColor={color} />;
}

export function OverviewPage({ color }: { color: string }) {
  return <PlaceholderPage title="Overview" subtitle="Company-wide overview across all sub-accounts" iconName="LayoutDashboard" iconColor={color} />;
}

export function CompliancePage({ color }: { color: string }) {
  return <PlaceholderPage title="Compliance" subtitle="Fleet and driver compliance across all sub-accounts" iconName="ShieldCheck" iconColor={color} />;
}

export function SubAccountViewPage({ color, name }: { color: string; name: string }) {
  // Map sub-account display name or route to its corresponding database key filter
  const lowerName = name.toLowerCase();
  let subAccountKey = 'all';
  if (lowerName.includes('mcl')) subAccountKey = 'mcl';
  else if (lowerName.includes('tarmal')) subAccountKey = 'tarmal';
  else if (lowerName.includes('csl')) subAccountKey = 'csl';
  else if (lowerName.includes('mushroom')) subAccountKey = 'mushroom';

  return <LiveMonitor color={color} subAccountFilter={subAccountKey} />;
}
