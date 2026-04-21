import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Wraps the Supabase client and throws on any write operation. The client is
// only ever used for .select() queries against voice_profiles and voice_posts.

const BLOCKED_METHODS = ['insert', 'update', 'delete', 'upsert'] as const;

type ReadonlyTable = {
  select: (...args: unknown[]) => unknown;
};

function wrapTable(builder: ReadonlyTable): ReadonlyTable {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && (BLOCKED_METHODS as readonly string[]).includes(prop)) {
        throw new Error(
          `[supabase-readonly] blocked write operation: .${prop}() — the experiment never writes to production`,
        );
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

let cached: SupabaseClient | null = null;

export function getSupabaseReadonly(): SupabaseClient {
  if (cached) return cached;

  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const raw = createClient(url, key, {
    auth: { persistSession: false },
  });

  cached = new Proxy(raw, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => wrapTable(target.from(table) as unknown as ReadonlyTable);
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as SupabaseClient;

  return cached;
}
