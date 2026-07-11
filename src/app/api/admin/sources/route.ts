import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tier → default credibility weight (functional spec §4.3).
const TIER_WEIGHT: Record<number, number> = { 1: 0.95, 2: 0.7, 3: 0.4 };

/** List every source (including inactive) for the admin registry. */
export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = createServiceClient();
  const { data, error } = await db.from('sources').select('*').order('tier').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data });
}

/** Add a source. Body: { name, url, feed_url, tier, category_hint? } */
export async function POST(req: NextRequest) {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.feed_url || !body?.url || !body?.tier) {
    return NextResponse.json({ error: 'name, url, feed_url and tier are required' }, { status: 400 });
  }
  const tier = Number(body.tier);
  const db = createServiceClient();
  const { data, error } = await db
    .from('sources')
    .insert({
      name: body.name,
      url: body.url,
      feed_url: body.feed_url,
      fetch_type: body.fetch_type ?? 'rss',
      tier,
      weight: body.weight ?? TIER_WEIGHT[tier] ?? 0.5,
      category_hint: body.category_hint ?? null,
      is_active: true,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}

/** Update a source. Body: { id, is_active?, tier?, weight?, name?, feed_url? } */
export async function PATCH(req: NextRequest) {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of ['name', 'url', 'feed_url', 'tier', 'weight', 'category_hint', 'is_active'] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (patch.tier !== undefined && patch.weight === undefined) {
    patch.weight = TIER_WEIGHT[Number(patch.tier)] ?? 0.5;
  }

  const db = createServiceClient();
  const { data, error } = await db.from('sources').update(patch).eq('id', body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}
