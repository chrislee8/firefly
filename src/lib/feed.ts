import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/slug';
import type { FeedArticle, Source } from '@/lib/types';

export const PAGE_SIZE = 24;
export type SortMode = 'top' | 'latest';

export interface FeedQuery {
  sort?: SortMode;
  category?: string;
  sourceName?: string;
  page?: number;
}

export interface FeedPage {
  items: FeedArticle[];
  page: number;
  hasMore: boolean;
}

// ── feed (ranked / filtered / paginated) ──────────────────────────────
async function fetchFeed(q: FeedQuery): Promise<FeedPage> {
  const db = createPublicClient();
  const page = Math.max(0, q.page ?? 0);
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE; // fetch one extra to detect hasMore

  let query = db.from('feed_articles').select('*');
  if (q.category) query = query.eq('category', q.category);
  if (q.sourceName) query = query.eq('source_name', q.sourceName);
  query =
    q.sort === 'latest'
      ? query.order('published_at', { ascending: false })
      : query.order('effective_score', { ascending: false });

  const { data, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as FeedArticle[];
  const hasMore = rows.length > PAGE_SIZE;
  return { items: rows.slice(0, PAGE_SIZE), page, hasMore };
}

const cachedFeed = unstable_cache(fetchFeed, ['feed-v1'], { revalidate: 300, tags: ['feed'] });
const feedLastGood = new Map<string, FeedPage>();

/** Ranked feed — resilient: serves cached/last-good data instead of erroring on a DB blip. */
export async function getFeed(q: FeedQuery = {}): Promise<FeedPage> {
  const key = JSON.stringify(q);
  try {
    const pageResult = await cachedFeed(q);
    feedLastGood.set(key, pageResult);
    return pageResult;
  } catch {
    return feedLastGood.get(key) ?? { items: [], page: q.page ?? 0, hasMore: false };
  }
}

// ── single article detail ─────────────────────────────────────────────
/** Single article (view row) by id. Returns null on miss/failure (→ 404, never a crash). */
export async function getArticle(id: string): Promise<FeedArticle | null> {
  try {
    const db = createPublicClient();
    const { data, error } = await db
      .from('feed_articles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as FeedArticle) ?? null;
  } catch {
    return null;
  }
}

// ── sources ───────────────────────────────────────────────────────────
async function fetchSources(): Promise<Source[]> {
  const db = createPublicClient();
  const { data, error } = await db
    .from('sources')
    .select('*')
    .eq('is_active', true)
    .order('tier', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Source[];
}

const cachedSources = unstable_cache(fetchSources, ['sources-v1'], { revalidate: 600, tags: ['feed'] });
let sourcesLastGood: Source[] | null = null;

/** Active sources — resilient (cached + stale-on-error). */
export async function getSources(): Promise<Source[]> {
  try {
    const sources = await cachedSources();
    if (sources.length) sourcesLastGood = sources;
    return sources;
  } catch {
    return sourcesLastGood ?? [];
  }
}

/** Resolve a source slug (e.g. "the-verge-ai") back to its source. */
export async function resolveSourceSlug(slug: string): Promise<Source | null> {
  const sources = await getSources();
  return sources.find((s) => slugify(s.name) === slug) ?? null;
}
