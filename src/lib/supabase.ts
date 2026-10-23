import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const rawClient = createClient(supabaseUrl, supabaseAnonKey);

let currentSubAccount: string | null = null;

export function setSubAccountFilter(slug: string | null) {
  currentSubAccount = slug;
}

export function getSubAccountFilter(): string | null {
  return currentSubAccount;
}

const EXCLUDED_TABLES = new Set(['profiles']);

function shouldFilter(table: string): boolean {
  if (EXCLUDED_TABLES.has(table)) return false;
  return currentSubAccount !== null && currentSubAccount !== 'master';
}

function stampValues(values: any): any {
  const sa = currentSubAccount ?? 'master';
  if (Array.isArray(values)) {
    return values.map(v => ({ ...v, sub_account: v.sub_account ?? sa }));
  }
  return { ...values, sub_account: values.sub_account ?? sa };
}

export const supabase = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (table: string) => {
        const builder = target.from(table);
        return new Proxy(builder, {
          get(bTarget, bProp) {
            if (bProp === 'select') {
              return (...args: any[]) => {
                const result = bTarget.select(...args);
                return shouldFilter(table) ? result.eq('sub_account', currentSubAccount) : result;
              };
            }
            if (bProp === 'insert') {
              return (values: any, ...rest: any[]) => {
                return bTarget.insert(stampValues(values), ...rest);
              };
            }
            if (bProp === 'update') {
              return (values: any, ...rest: any[]) => {
                const result = bTarget.update(values, ...rest);
                return shouldFilter(table) ? result.eq('sub_account', currentSubAccount) : result;
              };
            }
            if (bProp === 'upsert') {
              return (values: any, ...rest: any[]) => {
                return bTarget.upsert(stampValues(values), ...rest);
              };
            }
            if (bProp === 'delete') {
              return (...args: any[]) => {
                const result = bTarget.delete(...args);
                return shouldFilter(table) ? result.eq('sub_account', currentSubAccount) : result;
              };
            }
            return (bTarget as any)[bProp];
          },
        });
      };
    }
    return Reflect.get(target, prop, receiver);
  },
}) as unknown as SupabaseClient;
