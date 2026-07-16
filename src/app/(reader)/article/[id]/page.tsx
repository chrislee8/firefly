import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getArticle } from '@/lib/feed';
import { timeAgo, hostOf } from '@/lib/format';
import { slugify } from '@/lib/slug';
import { CategoryPill } from '@/components/CategoryPill';
import { ScoreBadge } from '@/components/ScoreBadge';
import { safeHref } from '@/lib/safe-url';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id).catch(() => null);
  if (!article) return { title: 'Not found — Firefly' };
  return {
    title: `${article.title} — Firefly`,
    description: article.ai_summary ?? undefined,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id).catch(() => null);
  if (!article) notFound();

  const stat = (label: string, value: string) => (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );

  return (
    <article className="space-y-6">
      <Link href="/" className="text-xs hover:text-glow" style={{ color: 'var(--muted)' }}>
        ← Back to feed
      </Link>

      <div className="flex items-start gap-4">
        <ScoreBadge score={article.effective_score} size="lg" />
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <CategoryPill category={article.category} />
            <Link href={`/source/${slugify(article.source_name)}`} className="hover:text-foreground">
              {article.source_name}
            </Link>
            <span aria-hidden>·</span>
            <time dateTime={article.published_at}>{timeAgo(article.published_at)}</time>
          </div>
          <h1 className="text-2xl font-bold leading-tight">{article.title}</h1>
        </div>
      </div>

      {article.ai_summary && (
        <p className="text-base leading-relaxed" style={{ color: 'var(--foreground)' }}>
          {article.ai_summary}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat('Impact', `${Math.round(article.impact_score)}/100`)}
        {stat('Current rank score', `${article.effective_score}`)}
        {stat('Source tier', `Tier ${article.source_tier}`)}
        {stat('Category', article.category)}
      </div>

      <a
        href={safeHref(article.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 font-medium transition-colors hover:border-glow"
        style={{ background: 'var(--surface)', borderColor: 'var(--glow-dim)', color: 'var(--glow)' }}
      >
        Read the full story at {hostOf(article.url)} ↗
      </a>

      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Firefly links to the original publisher. The summary above is AI-generated for orientation and
        may differ from the source. The &ldquo;current rank score&rdquo; decays over time so newer
        significant stories surface first.
      </p>
    </article>
  );
}
