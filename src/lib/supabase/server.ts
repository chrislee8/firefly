import { createClient } from '@supabase/supabase-js';

/**
 * Public/anon client for server components reading the public feed.
 * Uses the anon key + RLS public-read policies (db/schema.sql).
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Service-role client for cron ingest/grade + admin writes.
 * Bypasses RLS. SERVER-ONLY — never import into a client component.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
