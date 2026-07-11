import Link from 'next/link';
import { CategoryPill } from '@/components/CategoryPill';
import { ScoreBadge } from '@/components/ScoreBadge';
import { timeAgo, hostOf } from '@/lib/format';
import { slugify } from '@/lib/slug';
import type { FeedArticle } from '@/lib/types';

export function ArticleCard({ article }: { article: FeedArticle }) {
  return (
    <article
      className="group flex gap-4 rounded-xl border p-4 transition-colors hover:border-glow-dim"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="pt-0.5">
        <ScoreBadge score={article.effective_score} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--muted)' }}>
          <CategoryPill category={article.category} />
          <Link
            href={`/source/${slugify(article.source_name)}`}
            className="hover:text-foreground"
          >
            {article.source_name}
          </Link>
          <span aria-hidden>·</span>
          <time dateTime={article.published_at}>{timeAgo(article.published_at)}</time>
          {article.source_tier === 1 && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
              style={{ background: 'var(--surface-2)', color: 'var(--glow-dim)' }}
            >
              Primary
            </span>
          )}
        </div>

        <h2 className="text-[15px] font-semibold leading-snug">
          <Link href={`/article/${article.id}`} className="group-hover:text-glow transition-colors">
            {article.title}
          </Link>
        </h2>

        {article.ai_summary && (
          <p className="mt-1.5 line-clamp-2 text-sm" style={{ color: 'var(--muted)' }}>
            {article.ai_summary}
          </p>
        )}

        <div className="mt-2">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:text-glow"
            style={{ color: 'var(--glow-dim)' }}
          >
            Read at {hostOf(article.url)} ↗
          </a>
        </div>
      </div>
    </article>
  );
}
