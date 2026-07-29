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

`src/proxy.ts` (Next 16 proxy convention, formerly middleware) refreshes the Supabase session cookie on `/admin` + `/api/admin` routes. `lib/auth.ts#getUser()` gates admin pages and write routes. Public site is fully unauthenticated.

## Cost posture

Every layer on a free tier (Supabase, Gemini Flash, GitHub Actions, Vercel Hobby). Article metadata is tiny relative to Supabase's 500 MB; batched grading keeps Gemini calls well within the free daily quota. See technical spec §1.5 for per-layer caveats.

---

## Firefly v2 — fine-tuned grader (technical overview)

*Phased plan & task list → `CHANGELOG.md`.*

Replace the Gemini grading call with a small open-weight model we fine-tune ourselves and serve locally, behind a provider switch. Same `{impactScore, category, aiSummary}` contract as v1.

**Training ≠ serving (the one concept to get right).**

| Stage | Tool | Runs on |
|---|---|---|
| Train (LoRA) | **MLX-LM** | M1 Max |
| Package (fuse) | MLX / llama.cpp | M1 Max |
| Serve | **Ollama** (or `mlx_lm.server`) | M1 Max |

MLX *trains*; Ollama only *serves*. Base = `Qwen2.5-3B-Instruct` (small enough to LoRA in 32 GB, instruct-tuned, MLX-friendly) → fused → served as `firefly-grader`. Existing Ollama models (`gemma3`, `qwen2.5-coder`) are baselines to beat, not the base.

**Two pipelines — offline builds the model, online serves it.**

```
OFFLINE  Supabase grades ─► export JSONL ─► MLX LoRA (Qwen 3B) ─► fuse ─► firefly-grader
                                                                              │ serves
ONLINE   cron ─► grader provider ─┬─ gemini (v1, fallback) ────────────────┐  │
                                  ├─ openai-ft (Path A) ───────────────────┤◄─┘
                                  └─ local → Ollama /v1 (Path B) ──────────┘  ─► grades table
```

**Provider interface (the one app change).** `src/lib/grader/` exposes a `GraderProvider` with `grade(batch)`, selected by `GRADER_PROVIDER` env (`gemini | openai-ft | local`). `local` and `openai-ft` both call an OpenAI-compatible `/v1` (Ollama at `127.0.0.1:11434`); v1's `SYSTEM_INSTRUCTION` + `responseSchema` are reused verbatim. Gemini stays the default fallback; promotion is **eval-gated and one-env-var reversible**.

**Training data (already exists in `grades`).** Input `{title, source_excerpt, source_tier, source_name}` → target `{impact_score, category, ai_summary}` (`grades.raw_model_output` jsonb is the cleanest target). Emit chat-format JSONL. Split: de-dupe by `canonical_url`; **all `is_manual_override=true` rows → test set (gold)**; time-split the rest (older→train), ~300 test / ~10% val.

**Evaluation — rate vs. ground truth, NOT vs. Gemini.** We train on Gemini's output, so agreement-with-Gemini only proves copying. Run both graders over the same test set and score each against an independent answer key (human overrides first, hand-labels next, a stronger-model judge last).

| Grade field | Metric |
|---|---|
| `category` (1 of 7) | accuracy / macro-F1 |
| `impactScore` (0–100) | MAE (avg abs gap) |
| **feed order** | **NDCG@10 / MRR** — the decider; the product *is* a ranked feed |
| `aiSummary` | LLM-as-judge (later) |
| reliability | valid-JSON %, $/1k, ms/item |

Worked example — truth `Model Release, 85`: firefly says `Model Release, 79` → category ✓, score error `|85−79| = 6`; average errors across the test set → the scorecard. Verdict: ship if firefly matches/beats Gemini's NDCG at $0 + lower latency; if NDCG collapses, keep training / keep Gemini.

**Hardware (M1 Max, 32 GB).** 3B LoRA is comfortable; 7B tight; ≥14B or a full (non-LoRA) fine-tune = rent a cloud GPU. Grading is deliberately narrow so a small model suffices.
