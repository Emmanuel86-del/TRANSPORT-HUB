import { SubAccount } from '@/lib/portals';

// Each sub-account reads and writes its OWN trips table in Supabase.
const TRIP_TABLES: Record<string, string> = {
  mcl: 'mcl_trips',
  csl: 'csl_trips',
  tarmal: 'tarmal_trips',
  pnmashru: 'pn_mashru_trips',
  mushroom: 'pn_mashru_trips', // old slug, kept so existing links and users still work
};

export function getTripsTable(subAccount: SubAccount | string): string {
  return TRIP_TABLES[subAccount] ?? 'sub_account_trips';
}
