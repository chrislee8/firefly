import { createServiceClient } from '@/lib/supabase/server';
import { ArticleAdmin, type AdminArticle } from '@/components/admin/ArticleAdmin';
import { EmptyState } from '@/components/EmptyState';
import type { Category } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface GradeRow {
  impact_score: number;
  category: Category;
  is_manual_override: boolean;
  graded_at: string;
}

export default async function AdminArticlesPage() {
  const db = createServiceClient();
  const { data } = await db
    .from('articles')
    .select('id, title, url, status, published_at, sources(name), grades(impact_score, category, is_manual_override, graded_at)')
    .order('created_at', { ascending: false })
    .limit(150);

  const articles: AdminArticle[] = (data ?? []).map((row) => {
    const src = Array.isArray(row.sources) ? row.sources[0] : row.sources;
    const grades = (row.grades ?? []) as GradeRow[];
    const latest = grades.sort(
      (a, b) => new Date(b.graded_at).getTime() - new Date(a.graded_at).getTime()
    )[0];
    return {
      id: row.id,
      title: row.title,
      url: row.url,
      status: row.status,
      published_at: row.published_at,
      source_name: src?.name ?? 'Unknown',
      impact_score: latest ? Math.round(latest.impact_score) : null,
      category: latest?.category ?? null,
      is_manual_override: latest?.is_manual_override ?? false,
    };
  });

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Recent articles · {articles.length}</h2>
      {articles.length === 0 ? (
        <EmptyState title="No articles yet" hint="Run the ingest job to pull articles from your sources." />
      ) : (
        <ArticleAdmin articles={articles} />
      )}
    </div>
  );
}
