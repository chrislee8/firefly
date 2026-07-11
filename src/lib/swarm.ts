import { createPublicClient } from '@/lib/supabase/server';
import type { Category } from '@/lib/types';

/** One firefly = one ranked article. `rank` 1 = highest (drives color/size/depth). */
export interface FireflyItem {
  id: string;
  title: string;
  source: string;
  minutesAgo: number;
  rank: number;
  url: string;
  category: Category;
  score: number;
}

const SWARM_LIMIT = 160; // design calls for 100–200 fireflies

/** Top graded articles by effective (recency-decayed) score, mapped to firefly items. */
export async function getSwarmItems(): Promise<FireflyItem[]> {
  const db = createPublicClient();
  const { data, error } = await db
    .from('feed_articles')
    .select('id, title, source_name, published_at, url, category, effective_score')
    .order('effective_score', { ascending: false })
    .limit(SWARM_LIMIT);

  if (error) throw new Error(error.message);

  const now = Date.now();
  return (data ?? []).map((row, i) => ({
    id: row.id as string,
    title: row.title as string,
    source: row.source_name as string,
    minutesAgo: Math.max(1, Math.round((now - new Date(row.published_at as string).getTime()) / 60000)),
    rank: i + 1,
    url: row.url as string,
    category: row.category as Category,
    score: Math.round(row.effective_score as number),
  }));
}
