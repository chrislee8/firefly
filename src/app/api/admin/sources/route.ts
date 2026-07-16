import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { asBool, asHttpUrl, asText, asTier, asWeight, isUuid } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tier → default credibility weight (functional spec §4.3).
const TIER_WEIGHT: Record<number, number> = { 1: 0.95, 2: 0.7, 3: 0.4 };

const badRequest = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

/** Log the real Postgres error, return a generic one — messages leak schema. */
function dbFailed(where: string, error: { message: string }) {
  console.error(`[admin/sources] ${where}:`, error.message);
  return NextResponse.json({ error: 'database error' }, { status: 500 });
}

/** List every source (including inactive) for the admin registry. */
export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = createServiceClient();
  const { data, error } = await db.from('sources').select('*').order('tier').order('name');
  if (error) return dbFailed('GET', error);
  return NextResponse.json({ sources: data });
}

/** Add a source. Body: { name, url, feed_url, tier, category_hint? } */
export async function POST(req: NextRequest) {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return badRequest('invalid json');

  const name = asText(body.name, 120);
  const url = asHttpUrl(body.url);
  const feedUrl = asHttpUrl(body.feed_url);
  const tier = asTier(body.tier);

  if (!name) return badRequest('name is required (1–120 chars)');
  if (!url) return badRequest('url must be an http(s) URL');
  if (!feedUrl) return badRequest('feed_url must be an http(s) URL');
  if (!tier) return badRequest('tier must be 1, 2 or 3');

  const fetchType = body.fetch_type === 'api' ? 'api' : 'rss';
  const weight = body.weight === undefined ? TIER_WEIGHT[tier] : asWeight(body.weight);
  if (weight === null) return badRequest('weight must be between 0 and 1');

  const db = createServiceClient();
  const { data, error } = await db
    .from('sources')
    .insert({
      name,
      url,
      feed_url: feedUrl,
      fetch_type: fetchType,
      tier,
      weight,
      category_hint: asText(body.category_hint, 40),
      is_active: true,
    })
    .select()
    .single();
  if (error) return dbFailed('POST', error);
  return NextResponse.json({ source: data });
}

/** Update a source. Body: { id, is_active?, tier?, weight?, name?, url?, feed_url? } */
export async function PATCH(req: NextRequest) {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return badRequest('invalid json');
  if (!isUuid(body.id)) return badRequest('a valid uuid id is required');

  // Explicit per-field validation rather than a blind allowlist copy: these
  // values reach the grading rubric (tier/weight) and a server-side fetch
  // (feed_url), so a malformed one corrupts scoring or points ingest inward.
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const v = asText(body.name, 120);
    if (!v) return badRequest('name must be 1–120 chars');
    patch.name = v;
  }
  if (body.url !== undefined) {
    const v = asHttpUrl(body.url);
    if (!v) return badRequest('url must be an http(s) URL');
    patch.url = v;
  }
  if (body.feed_url !== undefined) {
    const v = asHttpUrl(body.feed_url);
    if (!v) return badRequest('feed_url must be an http(s) URL');
    patch.feed_url = v;
  }
  if (body.tier !== undefined) {
    const v = asTier(body.tier);
    if (!v) return badRequest('tier must be 1, 2 or 3');
    patch.tier = v;
  }
  if (body.weight !== undefined) {
    const v = asWeight(body.weight);
    if (v === null) return badRequest('weight must be between 0 and 1');
    patch.weight = v;
  }
  if (body.is_active !== undefined) {
    const v = asBool(body.is_active);
    if (v === null) return badRequest('is_active must be a boolean');
    patch.is_active = v;
  }
  if (body.category_hint !== undefined) {
    patch.category_hint = asText(body.category_hint, 40); // null clears it
  }

  if (Object.keys(patch).length === 0) return badRequest('nothing to update');

  // Re-derive weight when the tier moves and no explicit weight was given.
  if (patch.tier !== undefined && body.weight === undefined) {
    patch.weight = TIER_WEIGHT[patch.tier as number];
  }

  const db = createServiceClient();
  const { data, error } = await db.from('sources').update(patch).eq('id', body.id).select().single();
  if (error) return dbFailed('PATCH', error);
  return NextResponse.json({ source: data });
}
