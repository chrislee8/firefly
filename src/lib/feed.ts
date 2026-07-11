import { createPublicClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/slug';
import type { FeedArticle, Source } from '@/lib/types';

export const PAGE_SIZE = 24;
export type SortMode = 'top' | 'latest';

export interface FeedQuery {
  sort?: SortMode;
  category?: string;   // exact category value
  sourceName?: string; // exact source name
  page?: number;       // 0-indexed
}

export interface FeedPage {
  items: FeedArticle[];
  page: number;
  hasMore: boolean;
}

/** Query the feed_articles view: ranked (Top) or chronological (Latest). */
export async function getFeed(q: FeedQuery = {}): Promise<FeedPage> {
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

/** Single article detail (view row) by id. */
export async function getArticle(id: string): Promise<FeedArticle | null> {
  const db = createPublicClient();
  const { data, error } = await db
    .from('feed_articles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FeedArticle) ?? null;
}

/** Active sources, for filter chips and the /source pages. */
export async function getSources(): Promise<Source[]> {
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

/** Resolve a source slug (e.g. "the-verge-ai") back to its exact name. */
export async function resolveSourceSlug(slug: string): Promise<Source | null> {
  const sources = await getSources();
  return sources.find((s) => slugify(s.name) === slug) ?? null;
}
