import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

/**
 * Constant-time string compare.
 *
 * Both sides are hashed to a fixed 32 bytes first: timingSafeEqual throws if
 * the buffers differ in length, and comparing the raw values would leak the
 * secret's length through that error.
 */
function secretsMatch(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest();
  const bh = createHash('sha256').update(b).digest();
  return timingSafeEqual(ah, bh);
}

/**
 * Guard for /api/cron/* — only the GitHub Actions workflow, which sends
 * the shared CRON_SECRET in the x-cron-secret header, may trigger these.
 *
 * Callers run on the nodejs runtime (see each route's `export const runtime`),
 * so node:crypto is available.
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  const header =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!header) return false;
  return secretsMatch(header, secret);
}
