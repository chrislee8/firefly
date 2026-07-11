import Parser from 'rss-parser';
import { createServiceClient } from '@/lib/supabase/server';
import type { ParsedItem, Source } from '@/lib/types';

const parser = new Parser({ timeout: 15000 });

// Only ingest reasonably recent items — keeps feeds focused on news, not
// back-catalogs (some sources publish their entire archive over RSS).
const MAX_AGE_DAYS = Number(process.env.INGEST_MAX_AGE_DAYS) || 30;

// Query params that carry no identity — stripped so syndicated/tracked
// links dedupe to the same canonical URL.
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src', 'source',
];

/** Normalize a URL for exact-match dedup (tech spec §4, functional spec §4.2). */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    // drop trailing slash on the path (but keep root "/")
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/** Strip HTML tags + collapse whitespace from a source excerpt; cap length. */
function cleanExcerpt(html: string | undefined | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > 500 ? text.slice(0, 497) + '…' : text;
}

/** Fetch + parse one source's feed into normalized items. */
async function fetchSource(source: Source): Promise<ParsedItem[]> {
  const feed = await parser.parseURL(source.feed_url);
  const cutoffTs = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const items: ParsedItem[] = [];
  for (const item of feed.items) {
    const url = item.link?.trim();
    if (!url || !item.title) continue;
    const published =
      item.isoDate || item.pubDate || new Date().toISOString();
    const publishedTs = new Date(published).getTime();
    if (Number.isFinite(publishedTs) && publishedTs < cutoffTs) continue;
    items.push({
      title: item.title.trim(),
      url,
      canonicalUrl: canonicalizeUrl(url),
      publishedAt: new Date(published).toISOString(),
      sourceExcerpt: cleanExcerpt(
        item.contentSnippet || item.content || item.summary
      ),
    });
  }
  return items;
}

export interface IngestResult {
  source: string;
  status: 'ok' | 'error';
  fetched: number;
  inserted: number;
  error?: string;
}

/**
 * Run one ingestion pass over all active sources.
 * Failures are isolated per source (functional spec §9) — one bad feed
 * never blocks the others, and its error is recorded on the source row.
 */
export async function runIngest(): Promise<IngestResult[]> {
  const db = createServiceClient();
  const { data: sources, error } = await db
    .from('sources')
    .select('*')
    .eq('is_active', true);

  if (error) throw new Error(`Failed to load sources: ${error.message}`);

  const results: IngestResult[] = [];

  for (const source of (sources ?? []) as Source[]) {
    let status: 'ok' | 'error' = 'ok';
    let errMsg: string | undefined;
    let fetched = 0;
    let inserted = 0;

    try {
      const items = await fetchSource(source);
      fetched = items.length;

      if (items.length) {
        const rows = items.map((it) => ({
          source_id: source.id,
          title: it.title,
          url: it.url,
          canonical_url: it.canonicalUrl,
          published_at: it.publishedAt,
          source_excerpt: it.sourceExcerpt,
          status: 'pending' as const,
        }));

        // Insert, ignoring rows whose canonical_url already exists.
        const { data, error: insErr } = await db
          .from('articles')
          .upsert(rows, { onConflict: 'canonical_url', ignoreDuplicates: true })
          .select('id');

        if (insErr) throw new Error(insErr.message);
        inserted = data?.length ?? 0;
      }
    } catch (e) {
      status = 'error';
      errMsg = e instanceof Error ? e.message : String(e);
    }

    await db
      .from('sources')
      .update({
        last_fetched_at: new Date().toISOString(),
        last_fetch_status: status,
        last_fetch_error: errMsg ?? null,
      })
      .eq('id', source.id);

    results.push({
      source: source.name,
      status,
      fetched,
      inserted,
      error: errMsg,
    });
  }

  return results;
}
