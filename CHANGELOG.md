# Firefly — Changelog & Plan

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

---

# Firefly v2 — Fine-tuned grader (planned)

Replace the Gemini Flash grading call with a small open-weight model we fine-tune ourselves,
serve locally, and validate with an evaluation harness — a $0, no-rate-limit, self-owned
grader. Technical overview → [`architecture.md`](architecture.md).

**Key facts:** base = `Qwen2.5-3B-Instruct` → LoRA via **MLX** (M1 Max) → served on **Ollama**
as `firefly-grader`. Ollama *serves*; MLX *trains*. Training data already exists in the `grades`
table (`raw_model_output` = targets, `is_manual_override=true` = gold labels). The swap is behind
a `GRADER_PROVIDER` env switch (`gemini | openai-ft | local`); Gemini stays as fallback,
promotion is **eval-gated** and one-env-var reversible.

## Milestone 0 — Data export
- [ ] Decide export language (Python rec.) + folder (`finetune/export/`)
- [ ] Connect to Supabase (service-role key from env; mirror `src/lib/supabase/server.ts`)
- [ ] Query `feed_articles` + `grades` (need `is_manual_override`, `raw_model_output`)
- [ ] Shape rows into chat JSONL (system = `SYSTEM_INSTRUCTION`, user = article, assistant = grade)
- [ ] Split: de-dupe by `canonical_url`; all overrides → **test**; time-split the rest (~300 test, ~10% val)
- [ ] Write `train/val/test.jsonl` + a **data card** (counts, category balance)
- [ ] Confirm how many `is_manual_override` rows exist (decides gold-set readiness vs. hand-labeling)

## Milestone 1 — Eval harness on the baseline (build metrics FIRST)
- [ ] `eval/run_eval.py` loads `test.jsonl`, runs a candidate, emits `scorecard.md`
- [ ] Metrics: category acc / macro-F1, impact MAE, **NDCG@10 / MRR** (the decider), valid-JSON %, $/1k, ms/item
- [ ] Score the **Gemini baseline** and an **un-tuned local** baseline (targets to beat)
- [ ] Three-way rating vs. ground truth — not agreement-with-Gemini (see design §6.1)

## Milestone 2 — Path B: open-weight LoRA (local)
- [ ] Add `mlx-lm`; download `Qwen2.5-3B-Instruct`
- [ ] `mlx_lm.lora` train on `train.jsonl`; tune rank / epochs / data size
- [ ] `mlx_lm.fuse` → serve (`mlx_lm.server` or Ollama import via Modelfile)
- [ ] Run the harness; iterate until it matches/beats the Gemini baseline

## Milestone 3 — Path A: managed fine-tune (OpenAI)
- [ ] Same JSONL → OpenAI fine-tuning job → `ft:` model id
- [ ] Run the harness; compare Path A vs. Path B head-to-head in one scorecard

## Milestone 4 — Wire into firefly (behind the switch)
- [ ] `src/lib/grader/` provider interface (`GraderProvider`) — extract v1 Gemini path
- [ ] Add `openai-ft` + `local` (Ollama OpenAI-compatible `/v1`) providers
- [ ] `GRADER_PROVIDER` env switch; Gemini stays default fallback
- [ ] Ship behind the flag; flip only if the scorecard says so

## Milestone 5 — Production-ops writeups (optional)
- [ ] Drift monitoring (grade distribution over time)
- [ ] Rollback story (flip the env var) + eval-gated deploy policy
- [ ] Latency / cost notes at cron volume
