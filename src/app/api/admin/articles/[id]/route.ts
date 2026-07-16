import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validate';
import { CATEGORIES, type Category } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Log the real Postgres error, return a generic one — messages leak schema. */
function dbFailed(where: string, error: { message: string }) {
  console.error(`[admin/articles] ${where}:`, error.message);
  return NextResponse.json({ error: 'database error' }, { status: 500 });
}

/**
 * Admin actions on one article:
 *   { action: 'hide' }                        → status = 'hidden'
 *   { action: 'unhide' }                      → status = 'graded'
 *   { action: 'override', impactScore, category } → new manual-override grade
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const db = createServiceClient();

  if (body?.action === 'hide' || body?.action === 'unhide') {
    const status = body.action === 'hide' ? 'hidden' : 'graded';
    const { error } = await db.from('articles').update({ status }).eq('id', id);
    if (error) return dbFailed('hide/unhide', error);
    return NextResponse.json({ ok: true, status });
  }

  if (body?.action === 'override') {
    // Validate before clamping: Math.max(0, Math.round(NaN)) is NaN, so the old
    // order only worked by accident and read as though it clamped junk to 0.
    const raw = Number(body.impactScore);
    if (!Number.isFinite(raw)) {
      return NextResponse.json({ error: 'impactScore must be a number 0–100' }, { status: 400 });
    }
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    // No silent fallback: this is a deliberate manual override, so a bad
    // category should fail loudly rather than quietly file the article as
    // 'Product' and look like the operator chose that.
    if (!CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }
    const category: Category = body.category;

    // A manual override is just a newer grade row — latest wins in feed_articles.
    const { error } = await db.from('grades').insert({
      article_id: id,
      impact_score: score,
      category,
      is_manual_override: true,
      raw_model_output: { override: true },
    });
    if (error) return dbFailed('override', error);

    // Ensure the article is visible again if it was pending.
    await db.from('articles').update({ status: 'graded' }).eq('id', id);
    return NextResponse.json({ ok: true, impactScore: score, category });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
