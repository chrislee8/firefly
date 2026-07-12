import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import type { Category } from '@/lib/types';

/** One firefly = one ranked article. `rank` 1 = highest (drives color/size/depth). */
export interface FireflyItem {
  id: string;
  title: string;
  source: string;
  minutesAgo: number;
  publishedAt: string; // ISO — used by /chronicle to bucket by month
  rank: number;
  url: string;
  category: Category;
  score: number;
}

const SKY_LIMIT = 160; // design calls for 100–200 fireflies

/** Raw query — throws on DB failure (handled by the resilient wrapper below). */
async function fetchSkyItems(): Promise<FireflyItem[]> {
  const db = createPublicClient();
  const { data, error } = await db
    .from('feed_articles')
    .select('id, title, source_name, published_at, url, category, effective_score')
    .order('effective_score', { ascending: false })
    .limit(SKY_LIMIT);

  if (error) throw new Error(error.message);

  const now = Date.now();
  return (data ?? []).map((row, i) => ({
    id: row.id as string,
    title: row.title as string,
    source: row.source_name as string,
    minutesAgo: Math.max(1, Math.round((now - new Date(row.published_at as string).getTime()) / 60000)),
    publishedAt: row.published_at as string,
    rank: i + 1,
    url: row.url as string,
    category: row.category as Category,
    score: Math.round(row.effective_score as number),
  }));
}

// Durable cache: serves the last result for ~5 min without touching the DB.
const cachedSkyItems = unstable_cache(fetchSkyItems, ['nightsky-items-v1'], {
  revalidate: 300,
  tags: ['feed'],
});

// In-memory stale-on-error fallback (per warm instance) for outages past the cache window.
let skyLastGood: FireflyItem[] | null = null;

/**
 * Top ranked articles as night-sky fireflies — resilient to DB outages.
 * Serves cached data through blips; on hard failure returns the last good set
 * (or empty → "warming up") instead of throwing an error page.
 */
export async function getNightSkyItems(): Promise<FireflyItem[]> {
  try {
    const items = await cachedSkyItems();
    if (items.length) skyLastGood = items;
    return items;
  } catch {
    return skyLastGood ?? [];
  }
}
