import Link from 'next/link';
import { CATEGORIES } from '@/lib/types';
import { slugify } from '@/lib/slug';
import type { SortMode } from '@/lib/feed';

/** Sort tabs (Top / Latest) + category filter chips. Pure links — no client JS. */
export function FeedControls({
  sort,
  activeCategory,
  base = '/list',
}: {
  sort: SortMode;
  activeCategory?: string;
  base?: string;
}) {
  const tab = (mode: SortMode, label: string) => {
    const active = sort === mode;
    const href = mode === 'top' ? base : `${base}?sort=latest`;
    return (
      <Link
        href={href}
        className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        style={{
          background: active ? 'var(--surface-2)' : 'transparent',
          color: active ? 'var(--glow)' : 'var(--muted)',
          border: `1px solid ${active ? 'var(--glow-dim)' : 'transparent'}`,
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {tab('top', '✦ Top')}
        {tab('latest', 'Latest')}
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat;
          return (
            <Link
              key={cat}
              href={active ? base : `/category/${slugify(cat)}`}
              className="rounded-full border px-3 py-1 text-xs transition-colors"
              style={{
                borderColor: active ? 'var(--glow-dim)' : 'var(--border)',
                color: active ? 'var(--glow)' : 'var(--muted)',
                background: active ? 'var(--surface-2)' : 'transparent',
              }}
            >
              {cat}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
