-- ============================================================
-- Firefly — AI Industry News Aggregator
-- Phase 1 schema (tech spec §4)
-- Run this in the Supabase SQL editor once per project.
-- ============================================================

-- ── sources ────────────────────────────────────────────────
-- The source registry. Admin-managed. `weight` is derived from
-- `tier` (see functional spec §4.3) and feeds the grading rubric.
create table if not exists sources (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  url               text not null,               -- human-facing homepage
  feed_url          text not null unique,        -- RSS/Atom feed or API endpoint (unique → idempotent seeds)
  fetch_type        text not null default 'rss', -- 'rss' | 'api'
  tier              int  not null,               -- 1 | 2 | 3
  weight            numeric not null,            -- 0.0–1.0, derived from tier
  category_hint     text,                        -- optional default category
  is_active         boolean not null default true,
  last_fetched_at   timestamptz,
  last_fetch_status text,                         -- 'ok' | 'error'
  last_fetch_error  text,
  created_at        timestamptz not null default now()
);

-- ── articles ───────────────────────────────────────────────
-- Metadata only — NO full source text stored (functional spec §4.2).
-- Exact-match dedup via unique(canonical_url).
create table if not exists articles (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid not null references sources(id) on delete cascade,
  title          text not null,
  url            text not null,
  canonical_url  text not null,
  published_at   timestamptz not null,
  source_excerpt text,                            -- source-provided short excerpt only
  ai_summary     text,                            -- LLM-written neutral summary (reworded)
  status         text not null default 'pending', -- 'pending' | 'graded' | 'hidden'
  created_at     timestamptz not null default now(),
  unique (canonical_url)
);

-- ── grades ─────────────────────────────────────────────────
-- One row per grading pass. Latest grade wins (see feed_articles view).
-- raw_model_output kept for audit / re-grade if the rubric changes.
create table if not exists grades (
  id                 uuid primary key default gen_random_uuid(),
  article_id         uuid not null references articles(id) on delete cascade,
  impact_score       numeric not null,            -- 0–100
  category           text not null,               -- Model Release | Funding | Regulation | Research | Product | Opinion
  raw_model_output   jsonb,
  is_manual_override boolean not null default false,
  graded_at          timestamptz not null default now()
);

-- ── indexes ────────────────────────────────────────────────
create index if not exists idx_articles_status    on articles(status);
create index if not exists idx_articles_published  on articles(published_at desc);
create index if not exists idx_articles_source     on articles(source_id);
create index if not exists idx_grades_article      on grades(article_id);
create index if not exists idx_grades_graded_at    on grades(graded_at desc);

-- ── feed_articles view ─────────────────────────────────────
-- Public read model: graded articles joined to their LATEST grade,
-- with a read-time recency-decayed `effective_score` (functional spec §5.5).
-- Half-life of 72h: a story's rank halves every 3 days without re-grading.
create or replace view feed_articles as
select
  a.id,
  a.source_id,
  a.title,
  a.url,
  a.canonical_url,
  a.published_at,
  a.source_excerpt,
  a.ai_summary,
  a.created_at,
  s.name  as source_name,
  s.tier  as source_tier,
  g.impact_score,
  g.category,
  g.is_manual_override,
  g.graded_at,
  round(
    (g.impact_score
     * power(0.5, extract(epoch from (now() - a.published_at)) / 3600.0 / 72.0)
    )::numeric,
    2
  ) as effective_score
from articles a
join sources s on s.id = a.source_id
join lateral (
  select gr.impact_score, gr.category, gr.is_manual_override, gr.graded_at
  from grades gr
  where gr.article_id = a.id
  order by gr.graded_at desc
  limit 1
) g on true
where a.status = 'graded';

-- ── Row Level Security ─────────────────────────────────────
-- Public site reads sources/articles/grades with the anon key.
-- Writes happen only via the service-role key (cron + admin routes),
-- which bypasses RLS entirely — so we enable RLS + public SELECT only.
alter table sources  enable row level security;
alter table articles enable row level security;
alter table grades   enable row level security;

drop policy if exists "public read sources"  on sources;
drop policy if exists "public read articles" on articles;
drop policy if exists "public read grades"   on grades;

create policy "public read sources"  on sources  for select using (true);
create policy "public read articles" on articles for select using (true);
create policy "public read grades"   on grades   for select using (true);

-- Let the view respect the base tables' RLS (public read), and grant the
-- anon/authenticated roles SELECT on the tables + view so the public site reads them.
alter view feed_articles set (security_invoker = on);
grant select on sources, articles, grades, feed_articles to anon, authenticated;
