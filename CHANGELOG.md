# Firefly — Changelog & Plan

## UX — night-sky logo is the firefly mark

- [x] The top-left logo mark is now the **firefly** (the exact favicon art, via a
  shared `FireflyMark` component) instead of a plain dot. It's fixed — it does
  **not** change with the `/style` toggle (which only restyles the sky sprites).

## Rework — month reel loads real months on demand

- [x] The night sky now **loads one month at a time**. `/?month=YYYY-MM` fetches
  that month's top articles (ranked by `impact_score` — recency decay is
  meaningless inside a past month); the default `/` is the latest month, still
  recency-ranked (`effective_score`).
- [x] Reel is driven by a **DB month range** (`getSkyMonthRange`), not the loaded
  items — so it spans months not currently on screen. `min` = the month we first
  ingested (`created_at`), `max` = latest news month (capped at the current month).
  Keying `min` off ingest time (not `published_at`) means **months before we
  launched never appear**, even though some feeds carry years-old original publish
  dates. Nothing hard-coded — bounds come straight from the data.
- [x] Reel shows only real months — **no future months**, no empty ones. Scroll or
  tap a month → navigates + reloads that month.
- [x] Removed the old client-side `chronicle` filter/toggle (data is now per-month)
  and the `/chronicle` command; the reel is the time-travel control.

## Fix — decode HTML entities in titles/summaries

- [x] Feed titles carried raw HTML entities from RSS (e.g. `Anthropic&#8217;s`),
  which React printed literally. Added `decodeEntities()` and apply it at the read
  layer (`lib/nightsky.ts`, `lib/feed.ts`) so every surface — night-sky card + hover,
  list, article page — shows real characters. Handles numeric/hex/named refs and
  double-encoding; no DB backfill needed (decoded at read).

## UX — night-sky card title is the article link

- [x] The popup card's article title is now the clickable link to the source (new
  tab, marks-as-read). Removed the separate "read →" action (redundant now that
  the title links). Read-state still shown by the colored dot. "✎ draft a take"
  unchanged.
- [x] Hover tooltip now shows the rank: `#<rank> · <title>` (was title only), so
  you can scan which firefly is #1 without clicking. Rank also still on the click
  card and encoded in firefly size/brightness.

## Admin auth → Clerk (shared with Dandelion)

Migrated `/admin` from Supabase Auth to **Clerk**, matching Dandelion so both apps
share **one** Clerk application (one admin identity for both).

- [x] Add `@clerk/nextjs`; `clerkMiddleware` in `src/proxy.ts` (conditional — pass-through when unconfigured)
- [x] `lib/admin-auth.ts` (`isAdmin()`, `CLERK_CONFIGURED`) replaces `lib/auth.ts` (Supabase); all admin pages + `/api/admin/*` routes gate on it
- [x] Generic "Permission denied" locked screen; real cause logged server-side only
- [x] Removed Supabase-auth code: `lib/auth.ts`, `components/admin/LoginForm.tsx`, `lib/supabase/{ssr,browser}.ts`
- [x] Builds green with **no** Clerk keys (public site unaffected; admin dev-only until keys set)

**Owner action items (needs Chris — Clerk dashboard + secrets):**
- [ ] In Clerk, pick ONE application to serve both apps (reuse Dandelion's if it exists). Copy its `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`.
- [ ] Add both keys to Firefly's Vercel project env (Production + Preview) and to local `.env.local`. Add `www.chrislee8.com` (+ `localhost`) to the Clerk instance's allowed origins / paths.
- [ ] Create the admin user in Clerk (Users → add) — that account is now the login for BOTH admins.
- [ ] **Verify at runtime** that Clerk's `auth()` is detected via `proxy.ts` (Next 16's renamed middleware). If Clerk errors "cannot detect clerkMiddleware", rename `src/proxy.ts` → `src/middleware.ts` (same code) as a fallback.
- [ ] Optional (single sign-on across both domains): configure Clerk multi-domain — primary + satellite for `dandelion.chrislee8.com` and `www.chrislee8.com`.

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
- [x] Night-sky UX pass: slot-machine **month reel** (top-right, tap a month to time-travel), removed rank legend, **terse `/` menu** + **`/help`** overlay, **`/language`** (en·cn·all) & **`/category`** filters, footer credit, and mobile support (tappable **`/` button**, tap-to-run, tap reliably opens a firefly).
- [x] Night-sky polish: **removed the jar**; reel font now **thin/tall** (Barlow Condensed 200) with a hover **font-size slider** (the vertical bar).
- [x] Read-state: clicking **read** turns that firefly **green** (persisted in localStorage → skip it next time); **fresh (<24h)** articles render **white** (read-me-first); reel current month matches neighbor color (just larger); the `/` square is **touch-only** while desktop keeps the centered `/` hint.

---

## Dropped — not pursuing (kept crossed-out so they don't get re-proposed)
- ~~firefly-in-a-jar animation on article open~~ — built it, didn't look good.
- ~~Full-text search via Postgres `tsvector`~~ — already covered by the `/search` keyword filter in the night sky; not needed at this scale.
- ~~Accounts & personalization (public auth, bookmarks, followed sources)~~ — firefly is a single-admin personal reader, not a multi-tenant product; personalization doesn't fit.
- ~~Distribution (public JSON API, daily digest email, secondary X/Reddit sources)~~ — no use case.

## Parked (optional, low priority)
- Fuzzy title dedup across outlets → "also covered by" corroboration (distinct from keyword search — dedupes the *same* story across outlets).

---

## v2 — fine-tuned grader → moved to the `finetune` repo

The local fine-tuned model that will replace the Gemini grading call is built in the separate **`finetune`** project (its own repo). When it's ready, firefly gains a small provider swap (`GRADER_PROVIDER` env; Gemini stays the fallback). Nothing in this repo depends on it today.
