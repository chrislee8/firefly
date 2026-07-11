'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { timeAgo } from '@/lib/format';
import type { Source } from '@/lib/types';

export function SourceManager({ initial }: { initial: Source[] }) {
  const router = useRouter();
  const [sources, setSources] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', feed_url: '', tier: '2' });

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch('/api/admin/sources', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) {
      const { source } = await res.json();
      setSources((prev) => prev.map((s) => (s.id === id ? source : s)));
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, tier: Number(form.tier) }),
    });
    if (res.ok) {
      const { source } = await res.json();
      setSources((prev) => [...prev, source]);
      setForm({ name: '', url: '', feed_url: '', tier: '2' });
      setAdding(false);
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error ?? 'Failed to add source');
    }
  }

  const input = {
    background: 'var(--background)',
    borderColor: 'var(--border)',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Source registry · {sources.length}</h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg border px-3 py-1 text-xs"
          style={{ borderColor: 'var(--glow-dim)', color: 'var(--glow)' }}
        >
          {adding ? 'Cancel' : '+ Add source'}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={add}
          className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" style={input} />
          <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" style={input}>
            <option value="1">Tier 1 — primary/labs</option>
            <option value="2">Tier 2 — reporting</option>
            <option value="3">Tier 3 — smaller/unverified</option>
          </select>
          <input required placeholder="Homepage URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" style={input} />
          <input required placeholder="RSS feed URL" value={form.feed_url} onChange={(e) => setForm({ ...form, feed_url: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" style={input} />
          <button type="submit" className="rounded-lg border px-4 py-2 text-sm font-medium sm:col-span-2" style={{ background: 'var(--surface-2)', borderColor: 'var(--glow-dim)', color: 'var(--glow)' }}>
            Add source
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--muted)' }} className="text-left text-xs">
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">Last fetch</th>
              <th className="px-3 py-2 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-3 py-2">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {s.feed_url}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={s.tier}
                    onChange={(e) => patch(s.id, { tier: Number(e.target.value) })}
                    className="rounded border px-1.5 py-1 text-xs"
                    style={input}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-xs">
                  {s.last_fetched_at ? (
                    <span style={{ color: s.last_fetch_status === 'error' ? '#fca5a5' : 'var(--muted)' }}>
                      {timeAgo(s.last_fetched_at)}
                      {s.last_fetch_status === 'error' && ' · error'}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>never</span>
                  )}
                  {s.last_fetch_error && (
                    <div className="max-w-[220px] truncate text-[11px]" style={{ color: '#fca5a5' }} title={s.last_fetch_error}>
                      {s.last_fetch_error}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => patch(s.id, { is_active: !s.is_active })}
                    className="rounded-full px-2.5 py-0.5 text-xs"
                    style={{
                      background: s.is_active ? 'rgba(134,239,172,0.12)' : 'var(--surface-2)',
                      color: s.is_active ? '#86efac' : 'var(--muted)',
                      border: `1px solid ${s.is_active ? '#86efac55' : 'var(--border)'}`,
                    }}
                  >
                    {s.is_active ? 'Active' : 'Paused'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
