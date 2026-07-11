import { NextRequest } from 'next/server';

/**
 * Guard for /api/cron/* — only the GitHub Actions workflow, which sends
 * the shared CRON_SECRET in the x-cron-secret header, may trigger these.
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === secret;
}
