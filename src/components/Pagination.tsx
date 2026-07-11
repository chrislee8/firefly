import Link from 'next/link';

/** Prev/Next pager. `href(page)` builds the URL for a given 0-indexed page. */
export function Pagination({
  page,
  hasMore,
  href,
}: {
  page: number;
  hasMore: boolean;
  href: (page: number) => string;
}) {
  if (page === 0 && !hasMore) return null;
  const linkStyle = {
    borderColor: 'var(--border)',
    background: 'var(--surface)',
  };
  return (
    <div className="flex items-center justify-between pt-2">
      {page > 0 ? (
        <Link
          href={href(page - 1)}
          className="rounded-lg border px-4 py-2 text-sm hover:border-glow-dim"
          style={linkStyle}
        >
          ← Newer
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        Page {page + 1}
      </span>
      {hasMore ? (
        <Link
          href={href(page + 1)}
          className="rounded-lg border px-4 py-2 text-sm hover:border-glow-dim"
          style={linkStyle}
        >
          Older →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
