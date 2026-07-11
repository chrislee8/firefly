import { getFeed, type SortMode } from '@/lib/feed';
import { ArticleCard } from '@/components/ArticleCard';
import { FeedControls } from '@/components/FeedControls';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sort: SortMode = sp.sort === 'latest' ? 'latest' : 'top';
  const page = Math.max(0, parseInt(sp.page ?? '0', 10) || 0);

  let feed;
  let dbError: string | null = null;
  try {
    feed = await getFeed({ sort, page });
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const href = (p: number) =>
    `/?${new URLSearchParams({ sort, ...(p ? { page: String(p) } : {}) }).toString()}`;

  return (
    <div className="space-y-5">
      <FeedControls sort={sort} />

      {dbError ? (
        <EmptyState
          title="Feed unavailable"
          hint="The database isn't connected yet. Add your Supabase keys to .env.local, run db/schema.sql + db/seed_sources.sql, then trigger ingest & grade."
        />
      ) : !feed || feed.items.length === 0 ? (
        <EmptyState
          title={page > 0 ? 'No more stories' : 'No graded stories yet'}
          hint={
            page > 0
              ? 'Head back to the first page.'
              : 'Once the ingest + grade jobs have run, the top AI stories will surface here.'
          }
        />
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
