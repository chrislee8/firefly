import { NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Clerk gates /admin (and makes auth() available to /api/admin, which self-gates
 * with a 401). The public site never touches Clerk.
 *
 * Note: in Next 16 the `middleware` convention is renamed to `proxy` — this file
 * IS the app's middleware, and clerkMiddleware runs as it. When Clerk isn't
 * configured yet, this is a pass-through; the /admin pages + routes still deny
 * access in production via lib/admin-auth.ts (the real, resource-based gate).
 */
const configured = !!process.env.CLERK_SECRET_KEY;

// clerkMiddleware returns a handler compatible with the proxy signature.
export const proxy = configured
  ? clerkMiddleware(async (auth, req) => {
      // Pages redirect anonymous users to sign-in; /api/admin is left to return
      // 401 from its own isAdmin() check rather than a redirect. (Path check
      // instead of createRouteMatcher, which Clerk has deprecated.)
      if (req.nextUrl.pathname.startsWith('/admin')) await auth.protect();
    })
  : function proxy() {
      return NextResponse.next();
    };

export const config = {
  // Cover /api/admin too so auth() works inside those route handlers.
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
