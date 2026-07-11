/** URL-safe slug from a source name or category (e.g. "The Verge AI" → "the-verge-ai"). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
