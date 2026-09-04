import Link from 'next/link';
import { isAdmin, CLERK_CONFIGURED } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// Deliberately generic: the public must not learn *why* access failed (whether
// Clerk is unconfigured, which env vars are missing, or that no user is signed
// in). The real reason is logged server-side instead — see AdminLayout.
function Locked() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-3xl" style={{ color: 'var(--glow)' }}>✦</p>
      <h1 className="mt-3 text-lg font-semibold">Permission denied</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
        You don&rsquo;t have access to this page.
      </p>
    </div>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // NOT the security boundary on its own: Next renders page children before the
  // layout, so each admin page/route also gates itself (see isAdmin usage).
  if (!(await isAdmin())) {
    // Server-side only (never sent to the client): record the actual cause so
    // an operator can diagnose it from the logs.
    console.warn(
      `[admin] access denied — ${
        CLERK_CONFIGURED
          ? 'no authenticated Clerk user'
          : 'Clerk not configured (set CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)'
      }`,
    );
    return <Locked />;
  }

  return (
    <div className="space-y-5">
      <div
        className="flex items-center justify-between rounded-xl border px-4 py-3"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin" className="font-semibold hover:text-glow">
            Sources
          </Link>
          <Link href="/admin/articles" className="hover:text-glow" style={{ color: 'var(--muted)' }}>
            Articles
          </Link>
        </nav>
        {!CLERK_CONFIGURED && (
          <span
            className="rounded px-2 py-1 text-[11px] uppercase tracking-wide"
            style={{ background: 'var(--surface-2)', color: 'var(--glow-dim)' }}
            title="No Clerk keys set — this admin is dev-only and blocked in production."
          >
            DEV · no auth
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
