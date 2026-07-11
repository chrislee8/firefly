import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { runIngest } from '@/lib/ingest';
import { runGrading } from '@/lib/grading';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Manually trigger a job from the admin panel: POST { job: 'ingest' | 'grade' }. */
export async function POST(req: NextRequest) {
  if (!(await getUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);

  try {
    if (body?.job === 'ingest') {
      const results = await runIngest();
      const inserted = results.reduce((s, r) => s + r.inserted, 0);
      return NextResponse.json({ ok: true, job: 'ingest', inserted, results });
    }
    if (body?.job === 'grade') {
      const result = await runGrading();
      return NextResponse.json({ ok: true, job: 'grade', ...result });
    }
    return NextResponse.json({ error: "job must be 'ingest' or 'grade'" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
