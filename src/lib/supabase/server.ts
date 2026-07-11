import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config';

/**
 * Public/anon client for server components reading the public feed.
 * Uses the anon key + RLS public-read policies (db/schema.sql).
 */
export function createPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Service-role client for cron ingest/grade + admin writes.
 * Bypasses RLS. SERVER-ONLY — never import into a client component.
 * The service-role key is a secret and comes from runtime env only.
 */
export function createServiceClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
