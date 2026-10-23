export type SubAccount = 'mcl' | 'tahmal' | 'csl' | 'mushroom' | 'master';

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

export const PORTALS: Record<SubAccount, PortalConfig> = {
  mcl: {
    slug: 'mcl',
    name: 'MCL',
    fullName: 'MCL Transport',
    color: '#1D4ED8',
    colorLight: '#3B82F6',
    colorDark: '#1E40AF',
    bgGradient: 'from-blue-600 to-blue-800',
    accentClass: 'blue',
  },
  tahmal: {
    slug: 'tahmal',
    name: 'TAHMAL',
    fullName: 'TAHMAL Logistics',
    color: '#15803D',
    colorLight: '#22C55E',
    colorDark: '#166534',
    bgGradient: 'from-emerald-600 to-emerald-800',
    accentClass: 'emerald',
  },
  csl: {
    slug: 'csl',
    name: 'CSL',
    fullName: 'CSL Freight',
    color: '#C2410C',
    colorLight: '#F97316',
    colorDark: '#9A3412',
    bgGradient: 'from-orange-600 to-orange-800',
    accentClass: 'orange',
  },
  mushroom: {
    slug: 'mushroom',
    name: 'MUSHROOM',
    fullName: 'Mushroom Transport',
    color: '#7C3AED',
    colorLight: '#A78BFA',
    colorDark: '#6D28D9',
    bgGradient: 'from-violet-600 to-violet-800',
    accentClass: 'violet',
  },
  master: {
    slug: 'master',
    name: 'Admin',
    fullName: 'Suraj Ashok Limited — Master',
    color: '#7E1219',
    colorLight: '#B91C1C',
    colorDark: '#5C0E14',
    bgGradient: 'from-red-800 to-red-950',
    accentClass: 'red',
  },
};

export const PORTAL_SLUGS: SubAccount[] = ['mcl', 'tahmal', 'csl', 'mushroom', 'master'];

const PATH_TO_SLUG: Record<string, SubAccount> = {
  '/mcl': 'mcl',
  '/tahmal': 'tahmal',
  '/csl': 'csl',
  '/mushroom': 'mushroom',
  '/admin': 'master',
  '/': 'master',
};

export function slugFromPath(pathname: string): SubAccount | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
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
