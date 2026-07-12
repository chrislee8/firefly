# Firefly — Changelog & Roadmap

## Phase 1 — Build now ✅ (code complete, awaiting live credentials)

### Foundation
- [x] Next.js 16 + TypeScript + Tailwind v4 scaffold
- [x] Dependencies: `rss-parser`, `@supabase/supabase-js`, `@supabase/ssr`, `@google/genai`
- [x] Firefly theme (deep-night + amber glow), env template, `.claude/launch.json`

### Database
- [x] Schema: `sources`, `articles`, `grades` + indexes (`db/schema.sql`)
- [x] `feed_articles` view with read-time recency decay (72h half-life)
- [x] RLS public-read policies + role grants
- [x] 12-source starter seed (`db/seed_sources.sql`)

### Ingestion
- [x] RSS fetch + normalize, per-source failure isolation
- [x] URL canonicalization → exact-match dedup
- [x] `/api/cron/ingest` with secret-header auth

### Grading
- [x] Batched Gemini Flash calls, structured JSON output, §5.3 rubric
- [x] Defensive parsing (bad batch stays `pending`), raw output stored for audit
- [x] `/api/cron/grade` with secret-header auth

### Public site
- [x] Home feed — Top (ranked) / Latest sort, category chips, pagination
- [x] `/category/[category]`, `/source/[source]`, `/article/[id]` detail
- [x] Graceful empty / DB-unavailable states

### Admin (`/admin`)
- [x] Supabase-auth login gate (proxy session refresh)
- [x] Source registry: add / toggle / tier edit + ingestion health panel
- [x] Article management: grade override, hide/unhide
- [x] Manual Ingest / Grade trigger buttons

### Ops
- [x] GitHub Actions cron workflow (every 30m: ingest → grade)
- [x] Verified: build passes, home + admin render, cron auth returns 401/500 as expected
- [x] README + architecture docs

### Live in production ✅ (2026-07-11)
- [x] Supabase project provisioned; `schema.sql` + seeds run via containerized `pg` migration
- [x] Gemini working on `gemini-flash-latest` (pinned `2.0-flash` had 0 free-tier quota)
- [x] First ingest + grade run against live data
- [x] Deployed to Vercel — **https://firefly-ochre-gamma.vercel.app**
- [x] Auto-deploy on push to `main` via GitHub Actions + Vercel CLI (no GitHub↔Vercel link needed)
- [x] Cron (GitHub Actions, every 30 min) ingesting + grading against production
- [ ] Create the admin user in Supabase Auth (only remaining item — enables `/admin`)

### Post-launch fixes & additions (2026-07-11)
- [x] China sources added: SCMP Tech, TechNode, Pandaily (EN) + QbitAI 量子位, Leiphone 雷锋网, 36Kr 36氪 (中文, English AI summaries)
- [x] 30-day recency cutoff on ingest (tames full-archive feeds)
- [x] `unique(feed_url)` constraint for idempotent source seeds
- [x] Grading capped to one batch/call + cron loops it (Vercel Hobby 60s function limit)
- [x] Dead/stale feeds deactivated: Anthropic, Meta AI, Qwen, Synced (no public RSS / stale)
- [x] **Night-sky front page** (three.js): each ranked article is a glowing 3D firefly (rank → color/size/depth), hover tooltip, click-to-open card, `/` command bar; `/motion -l` list ⇄ `/motion -a` night sky. Classic list at `/list`.
- [x] Custom domain live: **https://www.chrislee8.com**
- [x] Fixed prod "Feed unavailable": baked public Supabase URL+anon as code fallbacks (Vercel NEXT_PUBLIC build env proved unreliable)
- [x] **Resilient cached reads**: night-sky + list wrapped in `unstable_cache` (~5min) + stale-on-error fallback — a DB outage serves last-known-good news (fault-injection verified) instead of an error page. Gemini failures already graceful.
- [x] **`/chronicle`** time-scrub: month/year label + scroll to step back through time (only that month's fireflies render). **`/style`** switches firefly look: circle · firefly · ✦ icon. *(chronicle history grows as more months accrue; today all data is one month.)*
- [x] Vertical `/` command menu (clickable list + filter-as-you-type).
- [x] **+12 sources** — research/education (Google & Microsoft Research, MIT, BAIR, Ahead of AI, AWS ML), NVIDIA, and the AI-infrastructure layer (The Next Platform, Data Center Dynamics, The Register, IEEE Spectrum, ServeTheHome) — plus a new **`Infrastructure`** category (chips · data centers · power · networking) taught to the grader.
- [x] Night-sky UX pass: slot-machine **month reel** (top-right, tap a month to time-travel), removed rank legend, **terse `/` menu** + **`/help`** overlay, **`/language`** (en·cn·all) & **`/category`** filters, **firefly-in-a-jar** on click, footer credit, and mobile support (tappable **`/` button**, tap-to-run, tap reliably opens a firefly).

---

## Next up — firefly-in-a-jar on article open (TODO)
When you click a firefly to read an article, capture it in a little glass jar:
- [ ] Small SVG/CSS **jar** appears (near the card) with the article's rank-colored firefly glowing/pulsing inside
- [ ] Gentle animation — firefly drifts and blinks within the jar; releasing (close) lets it fly back
- [ ] Decide accent treatment on open (green vs black vs the jar itself) once we see the jar in place

## Phase 2 — Search & corroboration (optional)
- [ ] Fuzzy title dedup across outlets → `article_source_links` + "also covered by"
- [ ] Full-text search via Postgres `tsvector`

## Phase 3 — Accounts & personalization (optional)
- [ ] Public Supabase Auth, saved/bookmarked articles, followed sources/categories

## Phase 4 — Distribution (optional)
- [ ] Public read-only JSON API (rate-limited)
- [ ] Daily digest email; secondary signal sources (X / Reddit) as a lower-weight tier
