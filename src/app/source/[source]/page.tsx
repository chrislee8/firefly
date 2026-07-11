import { notFound } from 'next/navigation';
import { getFeed, resolveSourceSlug } from '@/lib/feed';
import { hostOf } from '@/lib/format';
import { ArticleCard } from '@/components/ArticleCard';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

export const dynamic = 'force-dynamic';

export default async function SourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ source: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { source: slug } = await params;
  const sp = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? '0', 10) || 0);

  const source = await resolveSourceSlug(slug);
  if (!source) notFound();

  const feed = await getFeed({ sort: 'latest', sourceName: source.name, page });
  const href = (p: number) => `/source/${slug}${p ? `?page=${p}` : ''}`;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">{source.name}</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Tier {source.tier} source · latest first
            </p>
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:text-glow"
            style={{ color: 'var(--glow-dim)' }}
          >
            {hostOf(source.url)} ↗
          </a>
        </div>
      </div>

      {feed.items.length === 0 ? (
        <EmptyState title={`No graded stories from ${source.name} yet`} />
      ) : (
        <>
          <div className="space-y-3">
            {feed.items.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
          <Pagination page={feed.page} hasMore={feed.hasMore} href={href} />
        </>
      )}
    </div>
  );
}
