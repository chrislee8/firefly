// Shared domain types (mirror db/schema.sql).

export type FetchType = 'rss' | 'api';
export type ArticleStatus = 'pending' | 'graded' | 'hidden';

/** Where a source is based. Drives the /region command. */
export const REGIONS = ['US', 'CN', 'EU', 'OTHER'] as const;
export type Region = (typeof REGIONS)[number];

export const CATEGORIES = [
  'Model Release',
  'Funding',
  'Regulation',
  'Research',
  'Infrastructure',
  'Product',
  'Opinion',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Source {
  id: string;
  name: string;
  url: string;
  feed_url: string;
  fetch_type: FetchType;
  tier: number;
  weight: number;
  region: Region;
  category_hint: string | null;
  is_active: boolean;
  last_fetched_at: string | null;
  last_fetch_status: 'ok' | 'error' | null;
  last_fetch_error: string | null;
  created_at: string;
}

export interface Article {
  id: string;
  source_id: string;
  title: string;
  url: string;
  canonical_url: string;
  published_at: string;
  source_excerpt: string | null;
  ai_summary: string | null;
  status: ArticleStatus;
  created_at: string;
}

export interface Grade {
  id: string;
  article_id: string;
  impact_score: number;
  category: Category;
  raw_model_output: unknown;
  is_manual_override: boolean;
  graded_at: string;
}

/** One row of the `feed_articles` view: article + latest grade + decayed score. */
export interface FeedArticle {
  id: string;
  source_id: string;
  title: string;
  url: string;
  canonical_url: string;
  published_at: string;
  source_excerpt: string | null;
  ai_summary: string | null;
  created_at: string;
  source_name: string;
  source_tier: number;
  source_region: Region;
  impact_score: number;
  category: Category;
  is_manual_override: boolean;
  graded_at: string;
  effective_score: number;
}

/** Normalized shape produced by the ingestion parser (functional spec §4.2). */
export interface ParsedItem {
  title: string;
  url: string;
  canonicalUrl: string;
  publishedAt: string; // ISO
  sourceExcerpt: string | null;
}
