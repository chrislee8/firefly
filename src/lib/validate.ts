// Input validation for the admin write routes.
//
// These endpoints are auth-gated, so this is not a barrier against anonymous
// attackers — it stops a typo or a malformed client from silently corrupting
// operational data. tier and weight feed the grading rubric directly, and
// feed_url is fetched server-side by the ingest job.

import { isSafeHttpUrl } from '@/lib/safe-url';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** Trimmed non-empty string within `max` chars, else null. */
export function asText(v: unknown, max = 300): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length > 0 && s.length <= max ? s : null;
}

/** Source tier is 1 | 2 | 3 — it drives ~25% of the impact score. */
export function asTier(v: unknown): 1 | 2 | 3 | null {
  const n = Number(v);
  return n === 1 || n === 2 || n === 3 ? (n as 1 | 2 | 3) : null;
}

/** Credibility weight is a 0..1 fraction. */
export function asWeight(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

export function asBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

/**
 * Hosts that must never be fetched server-side.
 *
 * A scheme allowlist alone stops file:// but not http://169.254.169.254 — a
 * perfectly valid http URL. feed_url is fetched by the ingest job, so these
 * are blocked by literal host/IP.
 *
 * Limits, stated plainly: this is a string check, not a resolver check. A
 * hostname that *resolves* to a private address still passes, and DNS
 * rebinding defeats it. Closing that needs resolve-then-check-every-IP with
 * redirects pinned, which is disproportionate for an admin-only field on a
 * runtime that does not expose an instance-metadata service.
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (h === 'localhost' || h.endsWith('.localhost') || h === '::1' || h === '0.0.0.0') return true;
  // IPv4 literals in private / loopback / link-local ranges.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) return true; // IPv6 ULA/link-local
  return false;
}

/**
 * An http(s) URL safe to store, else null.
 *
 * feed_url is handed to rss-parser server-side, so an unchecked value is an
 * SSRF vector; `url` is additionally rendered as an href.
 */
export function asHttpUrl(v: unknown): string | null {
  const s = asText(v, 2048);
  if (!s || !isSafeHttpUrl(s)) return null;
  try {
    if (isBlockedHost(new URL(s).hostname)) return null;
  } catch {
    return null;
  }
  return s;
}
