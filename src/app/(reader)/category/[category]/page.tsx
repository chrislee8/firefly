import { notFound } from 'next/navigation';
import { getFeed } from '@/lib/feed';
import { CATEGORIES } from '@/lib/types';
import { slugify } from '@/lib/slug';
import { ArticleCard } from '@/components/ArticleCard';
import { FeedControls } from '@/components/FeedControls';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { category: slug } = await params;
  const sp = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? '0', 10) || 0);

  const category = CATEGORIES.find((c) => slugify(c) === slug);
  if (!category) notFound();

  const feed = await getFeed({ sort: 'top', category, page });
  const href = (p: number) =>
    `/category/${slug}${p ? `?page=${p}` : ''}`;

  return (
    <div className="space-y-5">
      <FeedControls sort="top" activeCategory={category} />
      <h1 className="text-sm" style={{ color: 'var(--muted)' }}>
        Top stories in <span className="text-foreground font-semibold">{category}</span>
      </h1>

      {feed.items.length === 0 ? (
        <EmptyState title={`No ${category} stories yet`} />
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
