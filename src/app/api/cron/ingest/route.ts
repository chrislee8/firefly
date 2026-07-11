import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { runIngest } from '@/lib/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const results = await runIngest();
    const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const errors = results.filter((r) => r.status === 'error').length;
    return NextResponse.json({ ok: true, inserted, errors, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
