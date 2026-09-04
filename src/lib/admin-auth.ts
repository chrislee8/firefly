import { auth } from '@clerk/nextjs/server';

/**
 * Is Clerk actually configured? Only true when both keys are present, so the
 * build stays green and the public site never depends on Clerk.
 *
 * Firefly and Dandelion share one Clerk application — same keys in both — so a
 * single admin identity gates both apps. Setup steps: see CHANGELOG.md.
 */
export const CLERK_CONFIGURED =
  !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * May the current request use /admin (and /api/admin)?
 *
 * - Clerk configured → a signed-in user (proxy.ts already redirects anonymous
 *   visitors on page routes; this is the belt to that suspenders, and the sole
 *   gate on the API routes, which return 401 rather than redirect).
 * - Clerk NOT configured → allowed only in local dev, so the admin is
 *   previewable while it's being built but can never ship unprotected.
 */
export async function isAdmin(): Promise<boolean> {
  if (CLERK_CONFIGURED) {
    const { userId } = await auth();
    return !!userId;
  }
  return process.env.NODE_ENV !== 'production';
}
