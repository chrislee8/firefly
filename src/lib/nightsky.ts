import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import { decodeEntities } from '@/lib/format';
import type { Category, Region } from '@/lib/types';

/** One firefly = one ranked article. `rank` 1 = highest (drives color/size/depth). */
export interface FireflyItem {
  id: string;
  title: string;
  source: string;
  region: Region;
  minutesAgo: number;
  publishedAt: string; // ISO — used by /chronicle to bucket by month
  rank: number;
  url: string;
  category: Category;
  score: number;
}

const SKY_LIMIT = 160; // design calls for 100–200 fireflies

// Regions fetched for the sky. Each gets its own full-size sky so that
// switching via /region never lands on a near-empty view.
const SKY_REGIONS: Region[] = ['US', 'CN'];

// ── month helpers ─────────────────────────────────────────────────────
/** 'YYYY-MM' (UTC) for an ISO timestamp — matches the reel's month bucketing. */
function toMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
/** [start, end) ISO bounds of a 'YYYY-MM' month, in UTC. */
function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    end: new Date(Date.UTC(y, m, 1)).toISOString(),
  };
}

/**
 * Top articles for one region, ranked 1..n *within* that region.
 * - No `month` → the "now" view: recency-decayed `effective_score`.
 * - A `month` → that month's archive: pure `impact_score` (decay is meaningless
 *   inside a past month, so rank by significance).
 */
async function fetchRegion(region: Region, now: number, month?: string): Promise<FireflyItem[]> {
  const db = createPublicClient();
  let q = db
    .from('feed_articles')
    .select('id, title, source_name, source_region, published_at, url, category, impact_score, effective_score')
    .eq('source_region', region);
  if (month) {
    const { start, end } = monthBounds(month);
    q = q.gte('published_at', start).lt('published_at', end).order('impact_score', { ascending: false });
  } else {
    q = q.order('effective_score', { ascending: false });
  }
  const { data, error } = await q.limit(SKY_LIMIT);

  if (error) throw new Error(error.message);

  // Rank is per-region: it drives colour/size, so each region needs its own
  // #1 firefly — a global rank would render a filtered sky with no bright star.
  return (data ?? []).map((row, i) => ({
    id: row.id as string,
    title: decodeEntities(row.title as string),
    source: row.source_name as string,
    region: row.source_region as Region,
    minutesAgo: Math.max(1, Math.round((now - new Date(row.published_at as string).getTime()) / 60000)),
    publishedAt: row.published_at as string,
    rank: i + 1,
    url: row.url as string,
    category: row.category as Category,
    score: Math.round((month ? row.impact_score : row.effective_score) as number),
  }));
}

/** Raw query — throws on DB failure (handled by the resilient wrapper below). */
async function fetchSkyItems(month?: string): Promise<FireflyItem[]> {
  const now = Date.now();
  const perRegion = await Promise.all(SKY_REGIONS.map((r) => fetchRegion(r, now, month)));
  return perRegion.flat();
}

// Durable cache: serves the last result for ~5 min without touching the DB.
// The `month` argument is part of the cache key, so each month caches separately.
const cachedSkyItems = unstable_cache(fetchSkyItems, ['nightsky-items-v3'], {
  revalidate: 300,
  tags: ['feed'],
});

/** The months Firefly has been collecting news — drives the reel. */
export interface SkyMonthRange {
  min: string;
  max: string;
}

/**
 * Range = the month we first ingested (`created_at`) → the latest news month
 * (`published_at`, capped at the current month).
 *
 * Keying `min` off `created_at` — when a row entered our DB — rather than
 * `published_at` means months *before we launched* never appear, even though a
 * few feeds carry years-old original publish dates. Nothing is hard-coded: the
 * bounds come straight from the data.
 */
async function fetchMonthRange(): Promise<SkyMonthRange | null> {
  const db = createPublicClient();
  const [firstIngest, lastNews] = await Promise.all([
    db.from('feed_articles').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    db.from('feed_articles').select('published_at').order('published_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const createdIso = firstIngest.data?.created_at as string | undefined;
  const publishedIso = lastNews.data?.published_at as string | undefined;
  if (!createdIso || !publishedIso) return null;

  const min = toMonth(createdIso);
  // Cap at the current month so a stray future-dated feed item can't extend it.
  const nowMonth = toMonth(new Date().toISOString());
  const published = toMonth(publishedIso);
  const max = published <= nowMonth ? published : nowMonth;

  return { min: min <= max ? min : max, max };
}
const cachedMonthRange = unstable_cache(fetchMonthRange, ['nightsky-month-range'], { revalidate: 300, tags: ['feed'] });

/** Month range for the reel; null on empty/failure (reel simply hides). */
export async function getSkyMonthRange(): Promise<SkyMonthRange | null> {
  try {
    return await cachedMonthRange();
  } catch {
    return null;
  }
}

// In-memory stale-on-error fallback (per warm instance) for outages past the cache window.
let skyLastGood: FireflyItem[] | null = null;

/**
 * Top ranked articles as night-sky fireflies — resilient to DB outages.
 * Serves cached data through blips; on hard failure returns the last good set
 * (or empty → "warming up") instead of throwing an error page.
 */
export async function getNightSkyItems(month?: string): Promise<FireflyItem[]> {
  try {
    const items = await cachedSkyItems(month);
    if (items.length) skyLastGood = items;
    return items;
  } catch {
    return skyLastGood ?? [];
  }
}
