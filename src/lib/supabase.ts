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

/**
 * Wraps a Supabase query builder so that any chained method calls
 * are forwarded transparently, but select/update/delete get an
 * automatic .eq('sub_account', slug) filter prepended for non-master
 * portals on non-excluded tables.
 *
 * The wrapper preserves full chainability (.order, .limit, .eq, .single, etc.)
 * by proxying every property access and binding functions to the real builder.
 */
function wrapBuilder(builder: any, table: string, filterApplied = false): any {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      // Don't intercept Symbols (e.g. Symbol.toPrimitive, Symbol.iterator)
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver);
      }

      const value = Reflect.get(target, prop, receiver);

      // Non-function properties pass through as-is
      if (typeof value !== 'function') {
        return value;
      }

      // For methods, return a bound function that wraps the result
      return function (...args: any[]) {
        // Apply the sub_account filter before select/update/delete
        // by intercepting the verb call itself
        let result;
        const needsFilter = shouldFilter(table) && !filterApplied;

        if (prop === 'select' && needsFilter) {
          result = value.apply(target, args);
          result = result.eq('sub_account', currentSubAccount);
          return wrapBuilder(result, table, true);
        }

        if (prop === 'delete' && needsFilter) {
          result = value.apply(target, args);
          result = result.eq('sub_account', currentSubAccount);
          return wrapBuilder(result, table, true);
        }

        if (prop === 'update' && needsFilter) {
          result = value.apply(target, args);
          result = result.eq('sub_account', currentSubAccount);
          return wrapBuilder(result, table, true);
        }

        if (prop === 'insert') {
          result = value.call(target, stampValues(args[0]), ...args.slice(1));
          if (result && typeof result.then === 'function') return result;
          return wrapBuilder(result, table, filterApplied);
        }

        if (prop === 'upsert') {
          result = value.call(target, stampValues(args[0]), ...args.slice(1));
          if (result && typeof result.then === 'function') return result;
          return wrapBuilder(result, table, filterApplied);
        }

        // Default: call the method and wrap any chained builder result
        result = value.apply(target, args);

        // If result is a promise (terminal call like .single(), .maybeSingle(),
        // .then, or the data/error response), don't wrap it
        if (result && typeof result.then === 'function') {
          return result;
        }

        // If result is another builder (chainable), wrap it
        if (result && typeof result === 'object') {
          return wrapBuilder(result, table, filterApplied);
        }

        return result;
      };
    },
  });
}

export const supabase = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      const originalFrom = Reflect.get(target, prop, receiver);
      return function (table: string) {
        const builder = originalFrom.call(target, table);
        return wrapBuilder(builder, table);
      };
    }

    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  },
}) as unknown as SupabaseClient;
