-- ============================================================
-- Firefly — China AI news sources (verified public RSS feeds)
-- A primary lab (Qwen) + credible English-language China AI media.
-- Idempotent via unique(feed_url).
-- ============================================================

-- Ensure feed_url is unique so source seeds can be re-run safely.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sources_feed_url_key') then
    alter table sources add constraint sources_feed_url_key unique (feed_url);
  end if;
end $$;

insert into sources (name, url, feed_url, fetch_type, tier, weight, category_hint) values
  ('Alibaba Qwen', 'https://qwenlm.github.io/blog/',  'https://qwenlm.github.io/blog/index.xml', 'rss', 1, 0.90, 'Model Release'),
  ('Synced',       'https://syncedreview.com/',       'https://syncedreview.com/feed/',          'rss', 2, 0.72, 'Research'),
  ('SCMP Tech',    'https://www.scmp.com/tech',        'https://www.scmp.com/rss/36/feed',        'rss', 2, 0.72, 'Product'),
  ('Pandaily',     'https://pandaily.com/',            'https://pandaily.com/feed/',              'rss', 2, 0.62, 'Product'),
  ('TechNode',     'https://technode.com/',            'https://technode.com/feed/',              'rss', 2, 0.62, 'Product')
on conflict (feed_url) do nothing;

-- Chinese-language sources (titles stay in Chinese; grader writes English summaries).
insert into sources (name, url, feed_url, fetch_type, tier, weight, category_hint) values
  ('QbitAI 量子位',   'https://www.qbitai.com/',   'https://www.qbitai.com/feed',   'rss', 2, 0.75, 'Research'),
  ('Leiphone 雷锋网', 'https://www.leiphone.com/', 'https://www.leiphone.com/feed', 'rss', 2, 0.68, 'Product'),
  ('36Kr 36氪',       'https://36kr.com/',          'https://36kr.com/feed',         'rss', 2, 0.65, 'Funding')
on conflict (feed_url) do nothing;
