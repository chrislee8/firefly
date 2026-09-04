/**
 * Deep-link from a Firefly article to Dandelion's "New Idea" capture page,
 * pre-filling the title and source link so a news item can seed a blog idea.
 *
 * The link grants no access on its own — Dandelion's /admin is Clerk-gated, so
 * clicking it lands on Dandelion's sign-in unless you're already authed there.
 * Safe to render even to anonymous Firefly visitors.
 *
 * Host is prod by default; set NEXT_PUBLIC_DANDELION_ORIGIN to the staging host
 * (https://dandelion-staging.chrislee8.com) in .env.local while testing.
 */
const DANDELION_ORIGIN = (
  process.env.NEXT_PUBLIC_DANDELION_ORIGIN || 'https://dandelion.chrislee8.com'
).replace(/\/+$/, '');

export function draftTakeUrl(title: string, articleUrl: string, thought?: string): string {
  const query =
    `title=${encodeURIComponent(title)}` +
    `&link=${encodeURIComponent(articleUrl)}` +
    (thought ? `&thought=${encodeURIComponent(thought)}` : '');
  return `${DANDELION_ORIGIN}/admin/idea?${query}`;
}
