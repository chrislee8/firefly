// URL safety helpers shared by the ingest pipeline and the render layer.
//
// Kept dependency-free and in its own module on purpose: ingest.ts pulls in
// rss-parser, and client components import safeHref — importing from there
// would drag the parser into the browser bundle.

/**
 * True only for http(s) links.
 *
 * RSS feeds are third-party untrusted input, and `new URL()` happily parses
 * `javascript:` and `data:`. React does NOT sanitize href, so an unfiltered
 * feed link becomes stored XSS on our origin the moment a reader clicks it.
 */
export function isSafeHttpUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const { protocol } = new URL(raw.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false; // unparseable — refuse it rather than trust it
  }
}

/**
 * An href safe to render. Anything not http(s) collapses to '#'.
 *
 * Ingest already drops unsafe links, but rows stored before that guard existed
 * are still in the database — so the render layer must not assume clean data.
 */
export function safeHref(raw: string | null | undefined): string {
  return isSafeHttpUrl(raw) ? (raw as string).trim() : '#';
}
