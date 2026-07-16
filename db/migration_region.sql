-- ============================================================
-- Firefly — add `region` to sources.
-- Lets /region filter on real data instead of a hardcoded name list
-- in the app. Idempotent: safe to re-run.
-- ============================================================

alter table sources add column if not exists region text not null default 'US';

alter table sources drop constraint if exists sources_region_check;
alter table sources add constraint sources_region_check
  check (region in ('US', 'CN', 'EU', 'OTHER'));

-- Backfill China sources (db/seed_china_sources.sql), matched on feed_url —
-- the unique key, so this stays correct even if a display name is edited.
update sources set region = 'CN' where feed_url in (
  'https://qwenlm.github.io/blog/index.xml',  -- Alibaba Qwen (primary lab)
  'https://syncedreview.com/feed/',           -- Synced
  'https://www.scmp.com/rss/36/feed',         -- SCMP Tech
  'https://pandaily.com/feed/',               -- Pandaily
  'https://technode.com/feed/',               -- TechNode
  'https://www.qbitai.com/feed',              -- QbitAI 量子位
  'https://www.leiphone.com/feed',            -- Leiphone 雷锋网
  'https://36kr.com/feed'                     -- 36Kr 36氪
);

create index if not exists idx_sources_region on sources(region);

-- ── feed_articles: expose source region to the public read model ──
-- Additive only: existing consumers select named columns, so they are unaffected.
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
  s.name   as source_name,
  s.tier   as source_tier,
  g.impact_score,
  g.category,
  g.is_manual_override,
  g.graded_at,
  round(
    (g.impact_score
     * power(0.5, extract(epoch from (now() - a.published_at)) / 3600.0 / 72.0)
    )::numeric,
    2
  ) as effective_score,
  -- Appended last on purpose: `create or replace view` may only ADD columns at
  -- the end — inserting mid-list errors with "cannot change name of view column".
  s.region as source_region
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
