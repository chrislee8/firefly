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

### Remaining to go live (user actions)
- [ ] Create Supabase project + run `schema.sql` / `seed_sources.sql`
- [ ] Create the admin user in Supabase Auth
- [ ] Provision Gemini API key
- [ ] Fill real `.env.local`, trigger first ingest+grade, tune the grading prompt on real output
- [ ] Deploy to Vercel + set GitHub Actions secrets (`SITE_URL`, `CRON_SECRET`)

---

## Phase 2 — Search & corroboration (optional)
- [ ] Fuzzy title dedup across outlets → `article_source_links` + "also covered by"
- [ ] Full-text search via Postgres `tsvector`

## Phase 3 — Accounts & personalization (optional)
- [ ] Public Supabase Auth, saved/bookmarked articles, followed sources/categories

## Phase 4 — Distribution (optional)
- [ ] Public read-only JSON API (rate-limited)
- [ ] Daily digest email; secondary signal sources (X / Reddit) as a lower-weight tier
