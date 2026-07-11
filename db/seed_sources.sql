-- ============================================================
-- Firefly — starter source registry (global). 10 sources with
-- verified public RSS feeds, tiered per functional spec §4.3.
-- Idempotent via unique(feed_url).
--
-- NOTE: Anthropic and Meta AI were dropped — as of 2026-07 neither
-- publishes a public RSS/Atom feed (their pages declare none). Their
-- news still arrives via the tier-2 reporting sources below. Re-add
-- here if they ever ship a feed.
-- ============================================================

insert into sources (name, url, feed_url, fetch_type, tier, weight, category_hint) values
  -- ── Tier 1: lab / company announcements + raw research ──
  ('OpenAI Blog',          'https://openai.com/news/',               'https://openai.com/news/rss.xml',                                     'rss', 1, 1.00, 'Product'),
  ('Google DeepMind Blog', 'https://deepmind.google/discover/blog/', 'https://deepmind.google/blog/rss.xml',                                'rss', 1, 0.95, 'Research'),
  ('arXiv cs.AI',          'https://arxiv.org/list/cs.AI/recent',    'http://export.arxiv.org/rss/cs.AI',                                   'rss', 1, 0.90, 'Research'),
  -- ── Tier 2: reporting / analysis / tooling ──
  ('MIT Technology Review','https://www.technologyreview.com/topic/artificial-intelligence/', 'https://www.technologyreview.com/topic/artificial-intelligence/feed', 'rss', 2, 0.80, 'Research'),
  ('Import AI',            'https://importai.substack.com/',         'https://importai.substack.com/feed',                                  'rss', 2, 0.75, 'Opinion'),
  ('Ars Technica AI',      'https://arstechnica.com/tag/ai/',        'https://arstechnica.com/tag/ai/feed/',                                'rss', 2, 0.70, 'Product'),
  ('The Verge AI',         'https://www.theverge.com/ai-artificial-intelligence', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'rss', 2, 0.70, 'Product'),
  ('TechCrunch AI',        'https://techcrunch.com/category/artificial-intelligence/', 'https://techcrunch.com/category/artificial-intelligence/feed/', 'rss', 2, 0.70, 'Funding'),
  ('Hugging Face Blog',    'https://huggingface.co/blog',            'https://huggingface.co/blog/feed.xml',                                'rss', 2, 0.70, 'Model Release'),
  ('VentureBeat AI',       'https://venturebeat.com/category/ai/',   'https://venturebeat.com/category/ai/feed/',                           'rss', 2, 0.65, 'Funding')
on conflict (feed_url) do nothing;
