// Public Supabase connection config.
//
// URL + anon key are public (embedded in the client bundle, protected by RLS).
// They come from NEXT_PUBLIC_* env vars, which MUST be set as *non-sensitive*
// in Vercel (`vercel env add … --no-sensitive`) so they're inlined at build —
// sensitive vars are runtime-only and never reach the client bundle.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
