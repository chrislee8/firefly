'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/browser';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="mb-1 text-xl font-bold">
        Firefly <span className="glow-text">admin</span>
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--muted)' }}>
        Sign in to manage sources and grades.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-glow-dim"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-glow-dim"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
        {error && <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--glow-dim)', color: 'var(--glow)' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
