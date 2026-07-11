'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function JobRunner() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function run(job: 'ingest' | 'grade') {
    setBusy(job);
    setResult(null);
    try {
      const res = await fetch('/api/admin/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'failed');
      setResult(
        job === 'ingest'
          ? `Ingest done — ${data.inserted} new article(s).`
          : `Grade done — ${data.graded} graded, ${data.failedBatches} batch failure(s).`
      );
      router.refresh();
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  const btn = {
    background: 'var(--surface-2)',
    borderColor: 'var(--glow-dim)',
    color: 'var(--glow)',
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <span className="text-sm font-medium">Run jobs manually:</span>
      <button
        onClick={() => run('ingest')}
        disabled={!!busy}
        className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
        style={btn}
      >
        {busy === 'ingest' ? 'Ingesting…' : '↓ Ingest feeds'}
      </button>
      <button
        onClick={() => run('grade')}
        disabled={!!busy}
        className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
        style={btn}
      >
        {busy === 'grade' ? 'Grading…' : '✦ Grade pending'}
      </button>
      {result && (
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {result}
        </span>
      )}
    </div>
  );
}
