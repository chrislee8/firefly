# ✦ Firefly

**AI news, ranked by what matters.** Firefly continuously ingests AI-industry news from reliable sources, grades each story with an LLM (impact, source credibility, novelty), and presents a ranked, filterable feed. It stores only headlines + metadata and links out to the original publisher — never reproducing full content.

Built to run at **$0** on genuine free tiers.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres) — free tier |
| Auth | Supabase Auth (single admin user, gates `/admin` only) |
| LLM grading | Google Gemini Flash — free tier |
| Scheduled jobs | GitHub Actions (every 30 min) → internal cron API routes |
| Hosting | Vercel (Hobby) |

## Setup

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`db/schema.sql`](db/schema.sql), then [`db/seed_sources.sql`](db/seed_sources.sql) (12 starter RSS sources).
3. Create the admin user: **Authentication → Users → Add user** (email + password). This is the only login.
4. Grab **Project Settings → API**: project URL, `anon` key, and `service_role` key.

### 2. Gemini
Create a free API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).

### 3. Environment
```bash
cp .env.local.example .env.local
```
Fill in the Supabase URL/keys, `GEMINI_API_KEY`, and a long random `CRON_SECRET`.

### 4. Run locally
```bash
npm install
npm run dev            # http://localhost:3000
```
Sign in at `/admin`, then hit **Ingest feeds** and **Grade pending** to populate the feed.

## Deploy (Vercel + GitHub Actions cron)

1. Push to GitHub and import the repo in Vercel.
2. Add all `.env.local` vars as Vercel **Environment Variables**.
3. In the GitHub repo, add **Actions secrets**:
   - `SITE_URL` — your deployed URL (e.g. `https://firefly.vercel.app`)
   - `CRON_SECRET` — same value as in Vercel
4. [`.github/workflows/cron.yml`](.github/workflows/cron.yml) then fires `/api/cron/ingest` + `/api/cron/grade` every 30 min. Trigger it manually the first time from the **Actions** tab.

## How it works

```
GitHub Actions (every 30m) ──▶ /api/cron/ingest ──▶ parse RSS, dedup, insert (pending)
                           └─▶ /api/cron/grade  ──▶ batch Gemini call ──▶ scores + summaries
Public feed (/, /category, /source, /article) reads the ranked `feed_articles` view.
Admin (/admin) manages sources, overrides grades, and shows ingestion health.
```

See [`architecture.md`](architecture.md) for the full design and [`CHANGELOG.md`](CHANGELOG.md) for status/roadmap.
