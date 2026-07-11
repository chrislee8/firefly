// Public Supabase connection config.
//
// The project URL and the ANON key are *public* values — they are meant to be
// embedded in the client bundle and are protected by Row Level Security. We
// ship them as fallbacks so the app keeps working even when Vercel's build-time
// NEXT_PUBLIC_* env is empty (its CLI env storage has proven unreliable for
// build-time inlining). Secrets (service_role, Gemini, cron) are NOT here —
// they come from runtime env only.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ohpoviwiwpbbiyxgmtzv.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocG92aXdpd3BiYml5eGdtdHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MjU4MzUsImV4cCI6MjA5OTMwMTgzNX0.KffF9uYbjALOAgzzJ0Xm1WKERUJT1ohslDcD5eHk_rc';
