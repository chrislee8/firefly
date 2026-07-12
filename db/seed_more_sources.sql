-- ============================================================
-- Firefly — expansion sources (2026-07): top research/education,
-- an AI chipmaker, and the AI infrastructure/backbone layer.
-- All verified as live public RSS. Idempotent via unique(feed_url).
-- ============================================================

insert into sources (name, url, feed_url, fetch_type, tier, weight, category_hint) values
  -- ── Top research & educational ──
  ('Google Research',        'https://research.google/blog/',                            'https://research.google/blog/rss/',                                 'rss', 1, 0.90, 'Research'),
  ('Microsoft Research',     'https://www.microsoft.com/en-us/research/',                'https://www.microsoft.com/en-us/research/feed/',                    'rss', 1, 0.88, 'Research'),
  ('MIT News AI',            'https://news.mit.edu/topic/artificial-intelligence2',      'https://news.mit.edu/rss/topic/artificial-intelligence2',           'rss', 2, 0.75, 'Research'),
  ('Berkeley AI (BAIR)',     'https://bair.berkeley.edu/blog/',                          'https://bair.berkeley.edu/blog/feed.xml',                           'rss', 2, 0.75, 'Research'),
  ('Ahead of AI',            'https://magazine.sebastianraschka.com/',                   'https://magazine.sebastianraschka.com/feed',                        'rss', 2, 0.72, 'Opinion'),
  ('AWS ML Blog',            'https://aws.amazon.com/blogs/machine-learning/',           'https://aws.amazon.com/blogs/machine-learning/feed/',               'rss', 2, 0.68, 'Product'),
  -- ── AI companies / chipmakers ──
  ('NVIDIA Blog',            'https://blogs.nvidia.com/',                                'https://blogs.nvidia.com/feed/',                                    'rss', 2, 0.75, 'Infrastructure'),
  -- ── AI infrastructure / backbone ──
  ('The Next Platform',      'https://www.nextplatform.com/',                            'https://www.nextplatform.com/feed/',                                'rss', 2, 0.72, 'Infrastructure'),
  ('Data Center Dynamics',   'https://www.datacenterdynamics.com/',                      'https://www.datacenterdynamics.com/en/rss/',                        'rss', 2, 0.70, 'Infrastructure'),
  ('The Register AI',        'https://www.theregister.com/software/ai_ml/',              'https://www.theregister.com/software/ai_ml/headlines.atom',         'rss', 2, 0.68, 'Infrastructure'),
  ('IEEE Spectrum AI',       'https://spectrum.ieee.org/topic/artificial-intelligence/', 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss', 'rss', 2, 0.72, 'Research'),
  ('ServeTheHome',           'https://www.servethehome.com/',                            'https://www.servethehome.com/feed/',                                'rss', 3, 0.55, 'Infrastructure')
on conflict (feed_url) do nothing;
