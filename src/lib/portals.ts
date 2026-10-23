export type SubAccount = 'mcl' | 'tarmal' | 'csl' | 'mushroom' | 'master';

export type MCLArea = 'vipingo' | 'ngamani' | 'tezo' | 'roka';

export type PortalConfig = {
  slug: SubAccount;
  name: string;
  fullName: string;
  color: string;
  colorLight: string;
  colorDark: string;
  bgGradient: string;
  accentClass: string;
};

export type TabId =
  | 'live-monitor' | 'dashboard' | 'trips' | 'fuel' | 'tallies'
  | 'spare-parts' | 'containers' | 'reports' | 'overview' | 'tyres'
  | 'mcl' | 'tarmal' | 'csl' | 'mushroom' | 'users' | 'compliance';

export type NavTab = {
  id: TabId;
  label: string;
  icon: string;
};

export const PORTALS: Record<SubAccount, PortalConfig> = {
  mcl: {
    slug: 'mcl', name: 'MCL', fullName: 'MCL Transport',
    color: '#1D4ED8', colorLight: '#3B82F6', colorDark: '#1E40AF',
    bgGradient: 'from-blue-600 to-blue-800', accentClass: 'blue',
  },
  tarmal: {
    slug: 'tarmal', name: 'TARMAL', fullName: 'TARMAL Logistics',
    color: '#15803D', colorLight: '#22C55E', colorDark: '#166534',
    bgGradient: 'from-emerald-600 to-emerald-800', accentClass: 'emerald',
  },
  csl: {
    slug: 'csl', name: 'CSL', fullName: 'CSL Freight',
    color: '#C2410C', colorLight: '#F97316', colorDark: '#9A3412',
    bgGradient: 'from-orange-600 to-orange-800', accentClass: 'orange',
  },
  mushroom: {
    slug: 'mushroom', name: 'MUSHROOM', fullName: 'Mushroom Transport',
    color: '#7C3AED', colorLight: '#A78BFA', colorDark: '#6D28D9',
    bgGradient: 'from-violet-600 to-violet-800', accentClass: 'violet',
  },
  master: {
    slug: 'master', name: 'Admin', fullName: 'Suraj Ashok Limited — Master',
    color: '#7E1219', colorLight: '#B91C1C', colorDark: '#5C0E14',
    bgGradient: 'from-red-800 to-red-950', accentClass: 'red',
  },
};

export const MCL_AREAS: Record<MCLArea, { name: string; color: string; icon: string }> = {
  vipingo: { name: 'Vipingo', color: '#2563EB', icon: 'MapPin' },
  ngamani: { name: 'Ngamani', color: '#0891B2', icon: 'MapPin' },
  tezo: { name: 'Tezo', color: '#7C3AED', icon: 'MapPin' },
  roka: { name: 'Roka', color: '#DB2777', icon: 'MapPin' },
};

const SUB_ACCOUNT_TABS: NavTab[] = [
  { id: 'live-monitor', label: 'Live Monitor', icon: 'Activity' },
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'trips', label: 'Trips', icon: 'Route' },
  { id: 'fuel', label: 'Fuel', icon: 'Fuel' },
  { id: 'tallies', label: 'Tallies', icon: 'Calculator' },
  { id: 'spare-parts', label: 'Spare Parts', icon: 'Wrench' },
  { id: 'tyres', label: 'Tyres', icon: 'Disc' },
  { id: 'containers', label: 'Containers', icon: 'Package' },
  { id: 'compliance', label: 'Compliance', icon: 'ShieldCheck' },
  { id: 'reports', label: 'Reports', icon: 'FileText' },
];

const TARMAL_TABS: NavTab[] = SUB_ACCOUNT_TABS.map(t =>
  t.id === 'trips' ? { ...t, label: 'Long Distance Trips' } : t
);

const MASTER_TABS: NavTab[] = [
  { id: 'live-monitor', label: 'Live Monitor', icon: 'Activity' },
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'mcl', label: 'MCL', icon: 'Building2' },
  { id: 'tarmal', label: 'TARMAL', icon: 'Building2' },
  { id: 'csl', label: 'CSL', icon: 'Building2' },
  { id: 'mushroom', label: 'MUSHROOM', icon: 'Building2' },
  { id: 'users', label: 'Users', icon: 'Users' },
  { id: 'spare-parts', label: 'Spare Parts', icon: 'Wrench' },
  { id: 'tyres', label: 'Tyres', icon: 'Disc' },
  { id: 'containers', label: 'Containers', icon: 'Package' },
  { id: 'compliance', label: 'Compliance', icon: 'ShieldCheck' },
  { id: 'reports', label: 'Reports', icon: 'FileText' },
];

export function getTabsForPortal(slug: SubAccount): NavTab[] {
  if (slug === 'tarmal') return TARMAL_TABS;
  if (slug === 'master') return MASTER_TABS;
  return SUB_ACCOUNT_TABS;
}

export const PORTAL_SLUGS: SubAccount[] = ['mcl', 'tarmal', 'csl', 'mushroom', 'master'];

const PATH_TO_SLUG: Record<string, SubAccount> = {
  '/mcl': 'mcl', '/tarmal': 'tarmal', '/csl': 'csl',
  '/mushroom': 'mushroom', '/admin': 'master', '/': 'master',
};

export function slugFromPath(pathname: string): SubAccount | null {
  const clean = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  return PATH_TO_SLUG[clean] ?? null;
}

export function slugFromPathOrDefault(pathname: string): SubAccount {
  return slugFromPath(pathname) ?? 'master';
}

export function portalFromPath(pathname: string): PortalConfig | null {
  const slug = slugFromPath(pathname);
  return slug ? PORTALS[slug] : null;
}

export function pathForSlug(slug: SubAccount): string {
  if (slug === 'master') return '/admin';
  return `/${slug}`;
}

export function portalLabel(subAccount: string): string {
  const portal = PORTALS[subAccount as SubAccount];
  return portal ? portal.fullName : subAccount;
}
