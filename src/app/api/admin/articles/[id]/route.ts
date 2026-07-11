import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { CATEGORIES, type Category } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin actions on one article:
 *   { action: 'hide' }                        → status = 'hidden'
 *   { action: 'unhide' }                      → status = 'graded'
 *   { action: 'override', impactScore, category } → new manual-override grade
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const db = createServiceClient();

  if (body?.action === 'hide' || body?.action === 'unhide') {
    const status = body.action === 'hide' ? 'hidden' : 'graded';
    const { error } = await db.from('articles').update({ status }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status });
  }

  if (body?.action === 'override') {
    const score = Math.max(0, Math.min(100, Math.round(Number(body.impactScore))));
    if (!Number.isFinite(score)) {
      return NextResponse.json({ error: 'valid impactScore required' }, { status: 400 });
    }
    const category: Category = CATEGORIES.includes(body.category)
      ? body.category
      : 'Product';

    // A manual override is just a newer grade row — latest wins in feed_articles.
    const { error } = await db.from('grades').insert({
      article_id: id,
      impact_score: score,
      category,
      is_manual_override: true,
      raw_model_output: { override: true },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Ensure the article is visible again if it was pending.
    await db.from('articles').update({ status: 'graded' }).eq('id', id);
    return NextResponse.json({ ok: true, impactScore: score, category });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
