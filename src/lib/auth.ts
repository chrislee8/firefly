import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSSRClient } from '@/lib/supabase/ssr';

/**
 * Current admin user from the session cookie, or null.
 *
 * Uses auth.getUser() (validates the JWT with Supabase) rather than
 * getSession(), which would trust an attacker-editable cookie.
 *
 * Wrapped in React cache() so the layout and page can each gate independently
 * without paying for two round-trips per request.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
