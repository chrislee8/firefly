import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { LoginForm } from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // This check swaps the UI for a login form — it is NOT the security boundary.
  // Next renders `children` before handing them here, so each admin page gates
  // itself before querying. Do not rely on this alone.
  const user = await getUser();
  if (!user) return <LoginForm />;

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
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {user.email}
        </span>
      </div>
      {children}
    </div>
  );
}
