export type SubAccount = 'master' | 'mcl' | 'tarmal' | 'csl' | 'mushroom';

export type TabId =
  | 'live-monitor'
  | 'overview'
  | 'dashboard'
  | 'vehicles' // <-- Added Trucks / Vehicles tab ID
  | 'trips'
  | 'fuel'
  | 'tallies'
  | 'drivers'
  | 'spare-parts'
  | 'tyres'
  | 'containers'
  | 'compliance'
  | 'reports'
  | 'users'
  | 'mcl'
  | 'tarmal'
  | 'csl'
  | 'mushroom';

export type MCLArea = 'karuri' | 'kiambu' | 'ruiru' | 'thika';

export interface PortalConfig {
  slug: SubAccount;
  name: string;
  fullName: string;
  color: string;
  colorDark: string;
}

export const PORTALS: Record<SubAccount, PortalConfig> = {
  master: {
    slug: 'master',
    name: 'Suraj Ashok Limited',
    fullName: 'Suraj Ashok Limited — Master',
    color: '#8b0000',
    colorDark: '#5c0000',
  },
  mcl: {
    slug: 'mcl',
    name: 'MCL',
    fullName: 'MCL Freight',
    color: '#1e3a8a',
    colorDark: '#172554',
  },
  tarmal: {
    slug: 'tarmal',
    name: 'Tarmal',
    fullName: 'Tarmal Freight',
    color: '#047857',
    colorDark: '#064e3b',
  },
  csl: {
    slug: 'csl',
    name: 'CSL',
    fullName: 'CSL Freight',
    color: '#b45309',
    colorDark: '#78350f',
  },
  mushroom: {
    slug: 'mushroom',
    name: 'Mushroom',
    fullName: 'Mushroom Freight',
    color: '#6d28d9',
    colorDark: '#4c1d95',
  },
};

export interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

export function getTabsForPortal(slug: SubAccount): TabConfig[] {
  if (slug === 'master') {
    return [
      { id: 'live-monitor', label: 'Live Monitor', icon: 'Activity' },
      { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
      { id: 'mcl', label: 'MCL', icon: 'Building2' },
      { id: 'tarmal', label: 'Tarmal', icon: 'Building2' },
      { id: 'csl', label: 'CSL', icon: 'Building2' },
      { id: 'mushroom', label: 'Mushroom', icon: 'Building2' },
      { id: 'drivers', label: 'Drivers', icon: 'Users' },
      { id: 'vehicles', label: 'Trucks / Vehicles', icon: 'Truck' }, // <-- Added to Master sidebar
      { id: 'users', label: 'Users', icon: 'UserCog' },
      { id: 'spare-parts', label: 'Spare Parts', icon: 'Wrench' },
      { id: 'tyres', label: 'Tyres', icon: 'Disc' },
      { id: 'containers', label: 'Containers', icon: 'Package' },
      { id: 'compliance', label: 'Compliance', icon: 'ShieldCheck' },
      { id: 'reports', label: 'Reports', icon: 'FileText' },
    ];
  }

  // Sub-account portals (MCL, Tarmal, CSL, Mushroom)
  return [
    { id: 'live-monitor', label: 'Live Monitor', icon: 'Activity' },
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { id: 'trips', label: 'Trips', icon: 'Route' },
    { id: 'fuel', label: 'Fuel', icon: 'Fuel' },
    { id: 'tallies', label: 'Tallies', icon: 'Calculator' },
    { id: 'drivers', label: 'Drivers', icon: 'Users' },
    { id: 'vehicles', label: 'Trucks / Vehicles', icon: 'Truck' }, // <-- Added to Sub-account sidebar
    { id: 'spare-parts', label: 'Spare Parts', icon: 'Wrench' },
    { id: 'tyres', label: 'Tyres', icon: 'Disc' },
    { id: 'containers', label: 'Containers', icon: 'Package' },
    { id: 'compliance', label: 'Compliance', icon: 'ShieldCheck' },
    { id: 'reports', label: 'Reports', icon: 'FileText' },
  ];
}

export function portalFromPath(pathname: string): PortalConfig | undefined {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return PORTALS.master;
  return Object.values(PORTALS).find(p => p.slug === segment);
}

export function slugFromPath(pathname: string): SubAccount | undefined {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return 'master';
  if (PORTALS[segment as SubAccount]) return segment as SubAccount;
  return undefined;
}

export function pathForSlug(slug: SubAccount): string {
  if (slug === 'master') return '/admin';
  return `/${slug}`;
}
