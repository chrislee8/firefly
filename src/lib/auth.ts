import type { User } from '@supabase/supabase-js';
import { createSSRClient } from '@/lib/supabase/ssr';

/** Current admin user from the session cookie, or null. */
export async function getUser(): Promise<User | null> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
