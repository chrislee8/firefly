# Firefly — Architecture

Phase 1 implementation notes. Companion to the functional + technical specs.

## System overview

```
GitHub Actions (cron, */30m)
   │  x-cron-secret header
   ▼
Next.js on Vercel
   ├─ /api/cron/ingest   → runIngest()   (lib/ingest.ts)
   ├─ /api/cron/grade    → runGrading()  (lib/grading.ts)
   ├─ /api/admin/*       → source + article ops (auth-gated)
   ├─ public pages       → read `feed_articles` view (lib/feed.ts)
   └─ /admin/*           → source registry, grade override, health
   ▼
Supabase (Postgres): sources · articles · grades + feed_articles view
```

Single Next.js deployable — no separate worker service. Writes use the Supabase **service-role** key (bypasses RLS); public reads use the **anon** key against public-read RLS policies.

## Ingestion pipeline (`lib/ingest.ts`)

1. Load `is_active` sources.
2. Per source (failures isolated — one bad feed never blocks others): fetch feed with `rss-parser`, normalize to `{title, url, canonicalUrl, publishedAt, sourceExcerpt}`.
3. `canonicalizeUrl()` strips tracking params (`utm_*`, `fbclid`, …), `www`, trailing slash, hash → the dedup key.
4. Bulk `upsert(..., { onConflict: 'canonical_url', ignoreDuplicates: true })` → new rows land as `status = 'pending'`.
5. Record `last_fetched_at` / `last_fetch_status` / `last_fetch_error` on the source (drives the admin health panel).

**No full source text is stored** — only title, URL, published date, and the source's own short excerpt (functional spec §4.2).

## Grading pipeline (`lib/grading.ts`)

- Pulls up to 100 `pending` articles per run, batched **20 per Gemini call**.
- One structured-JSON call per batch (`responseSchema` + `responseMimeType`), rubric in the system instruction:
  - Impact ~50%, source credibility ~25% (from tier), novelty ~25%.
  - Recency is **deliberately excluded** here — it's applied at read time (see decay below) to avoid double-counting.
- Output per article: `impactScore` (0–100), `category`, one reworded `aiSummary`.
- Defensive: score clamped, category normalized, hallucinated ids dropped, raw output stored in `grades.raw_model_output` for audit. A batch that fails to parse is left `pending` for the next run — no partial writes.
- Manual overrides are just newer `grades` rows with `is_manual_override = true`.

## Read model & recency decay

`feed_articles` view joins each article to its **latest** grade and computes:

```
effective_score = impact_score * 0.5 ^ (hours_since_published / 72)
```

72-hour half-life → a story's rank halves every 3 days without re-grading, so yesterday's big news naturally sinks. Computed at read time (SQL), so no second "re-rank" cron job is needed in Phase 1.

- **Top** sort → `order by effective_score desc`
- **Latest** sort → `order by published_at desc`

## Data model

`sources` (registry + fetch health) · `articles` (metadata, `unique(canonical_url)`) · `grades` (score history, latest wins). See [`db/schema.sql`](db/schema.sql). Corroboration clustering (`article_source_links`) is deferred to Phase 2.

## Routes

| Route | Purpose |
|---|---|
| `/` | Ranked (Top) / chronological (Latest) feed |
| `/category/[category]` · `/source/[source]` | Filtered feeds |
| `/article/[id]` | Detail: summary, score breakdown, outbound link |
| `/api/cron/ingest` · `/api/cron/grade` | Cron jobs (secret-header auth) |
| `/api/admin/sources` · `/api/admin/articles/[id]` · `/api/admin/run` | Admin ops (Supabase-auth) |
| `/admin` · `/admin/articles` | Admin UI |

## Auth

Admin auth is **Clerk** (shared with Dandelion — one Clerk application, same keys in both apps, so a single identity gates both). `src/proxy.ts` (Next 16 proxy convention, formerly middleware) runs `clerkMiddleware`; anonymous visitors to `/admin` pages are redirected to Clerk's hosted sign-in. `lib/admin-auth.ts#isAdmin()` is the real, resource-based gate on every admin page and write route (`/api/admin/*` returns 401 rather than redirect). When Clerk keys are absent the proxy is a pass-through and `isAdmin()` allows access **only** in local dev — so the admin is previewable while unconfigured but can never ship unprotected (production shows a generic "Permission denied", with the real cause logged server-side). Public site is fully unauthenticated and never touches Clerk.

## Cost posture

Every layer on a free tier (Supabase, Gemini Flash, GitHub Actions, Vercel Hobby). Article metadata is tiny relative to Supabase's 500 MB; batched grading keeps Gemini calls well within the free daily quota. See technical spec §1.5 for per-layer caveats.
