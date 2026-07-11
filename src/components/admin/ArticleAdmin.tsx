'use client';

import { useState } from 'react';
import { CATEGORIES, type Category, type ArticleStatus } from '@/lib/types';
import { timeAgo } from '@/lib/format';

export interface AdminArticle {
  id: string;
  title: string;
  url: string;
  status: ArticleStatus;
  published_at: string;
  source_name: string;
  impact_score: number | null;
  category: Category | null;
  is_manual_override: boolean;
}

function Row({ article }: { article: AdminArticle }) {
  const [status, setStatus] = useState(article.status);
  const [score, setScore] = useState(article.impact_score);
  const [category, setCategory] = useState<Category | null>(article.category);
  const [editScore, setEditScore] = useState(String(article.impact_score ?? ''));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/admin/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    return res.ok ? res.json() : null;
  }

  async function toggleHide() {
    const action = status === 'hidden' ? 'unhide' : 'hide';
    const r = await call({ action });
    if (r) setStatus(r.status);
  }

  async function saveOverride() {
    const r = await call({
      action: 'override',
      impactScore: Number(editScore),
      category: category ?? 'Product',
    });
    if (r) {
      setScore(r.impactScore);
      setStatus('graded');
      setEditing(false);
    }
  }

  return (
    <tr className="border-t align-top" style={{ borderColor: 'var(--border)' }}>
      <td className="px-3 py-2">
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-glow">
          {article.title}
        </a>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          {article.source_name} · {timeAgo(article.published_at)}
        </div>
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <div className="flex flex-col gap-1">
            <input
              type="number"
              min={0}
              max={100}
              value={editScore}
              onChange={(e) => setEditScore(e.target.value)}
              className="w-16 rounded border px-1.5 py-1 text-xs"
              style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
            />
            <select
              value={category ?? 'Product'}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="rounded border px-1.5 py-1 text-xs"
              style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="font-mono text-sm" style={{ color: 'var(--glow)' }}>
            {score ?? '—'}
            {article.is_manual_override && (
              <span className="ml-1 text-[10px]" style={{ color: 'var(--glow-dim)' }} title="Manually overridden">
                ✎
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs" style={{ color: 'var(--muted)' }}>
        {status}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {editing ? (
            <>
              <button onClick={saveOverride} disabled={busy} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--glow-dim)', color: 'var(--glow)' }}>
                Save
              </button>
              <button onClick={() => setEditing(false)} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)' }}>
                Override
              </button>
              <button onClick={toggleHide} disabled={busy} className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)', color: status === 'hidden' ? '#86efac' : '#fca5a5' }}>
                {status === 'hidden' ? 'Unhide' : 'Hide'}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ArticleAdmin({ articles }: { articles: AdminArticle[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'var(--muted)' }} className="text-left text-xs">
            <th className="px-3 py-2 font-medium">Article</th>
            <th className="px-3 py-2 font-medium">Score</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((a) => (
            <Row key={a.id} article={a} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
