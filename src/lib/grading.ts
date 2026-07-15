import { Type } from '@google/genai';
import { getGemini, GEMINI_MODEL } from '@/lib/gemini';
import { createServiceClient } from '@/lib/supabase/server';
import { CATEGORIES, type Category } from '@/lib/types';

// 8 keeps a single Gemini call comfortably under Vercel Hobby's 60s function
// cap. At 20 the model's structured-output generation was overrunning it,
// timing out the cron grade step (504 FUNCTION_INVOCATION_TIMEOUT).
const BATCH_SIZE = 8;

// Article joined with its source tier — the grading input (functional spec §5.2).
interface Gradable {
  id: string;
  title: string;
  source_excerpt: string | null;
  published_at: string;
  source_name: string;
  source_tier: number;
}

interface ModelGrade {
  id: string;
  impactScore: number;
  category: Category;
  aiSummary: string;
}

const SYSTEM_INSTRUCTION = `You are an editor for an AI-industry news aggregator. You grade the significance of news items so the most important stories rank highest.

For each article you receive (title, source excerpt, source tier, source name), return:
- impactScore: integer 0–100 measuring how significant this is to the AI industry.
- category: exactly one of ${CATEGORIES.join(', ')}. Use "Infrastructure" for the compute backbone of AI — chips & foundries (NVIDIA, TSMC), data centers, cloud/compute capacity, networking, and power/energy for AI.
- aiSummary: ONE neutral, factual sentence written in ENGLISH, even when the source article is in another language (e.g. Chinese) — translate and summarize. Do NOT copy the excerpt verbatim — genuinely reword it. No hype, no opinion.

Scoring rubric — weight these factors (recency is handled separately downstream, so do NOT reward or penalize based on how old the item is):
- Impact (~50%): broad industry effect — major model releases, large funding rounds, regulation, major partnerships, safety incidents, and big compute/infrastructure moves (chip launches & supply, data-center buildouts, cloud capacity, AI power/energy deals) — score high; niche/incremental updates score low.
- Source credibility (~25%): tier 1 = primary labs/companies & top research (most trustworthy); tier 2 = established reporting; tier 3 = smaller/unverified. Higher tier lifts the score.
- Novelty/exclusivity (~25%): genuinely new or breaking scores higher than rehashes or roundups.

Raw research preprints (e.g. arXiv) should score low by default unless the abstract signals broad, landmark impact — most individual papers are incremental.

Return ONLY the structured JSON. Grade every article you are given, keyed by its exact id.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    grades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          impactScore: { type: Type.NUMBER },
          category: { type: Type.STRING, enum: [...CATEGORIES] },
          aiSummary: { type: Type.STRING },
        },
        required: ['id', 'impactScore', 'category', 'aiSummary'],
      },
    },
  },
  required: ['grades'],
};

function buildPrompt(batch: Gradable[]): string {
  const articles = batch.map((a) => ({
    id: a.id,
    title: a.title,
    excerpt: a.source_excerpt ?? '(no excerpt provided)',
    sourceTier: a.source_tier,
    sourceName: a.source_name,
  }));
  return `Grade these ${batch.length} articles:\n\n${JSON.stringify(articles, null, 2)}`;
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeCategory(c: unknown): Category {
  const match = CATEGORIES.find(
    (cat) => cat.toLowerCase() === String(c).trim().toLowerCase()
  );
  return match ?? 'Product';
}

export interface GradeResult {
  batches: number;
  graded: number;
  failedBatches: number;
}

/**
 * Grade up to BATCH_SIZE pending articles in ONE Gemini call.
 * Returns the number graded and whether the batch failed to parse
 * (failed articles are simply left `pending` for the next cron run).
 */
async function gradeBatch(batch: Gradable[]): Promise<number> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildPrompt(batch),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty model response');

  const parsed = JSON.parse(text) as { grades?: ModelGrade[] };
  const grades = parsed.grades;
  if (!Array.isArray(grades)) throw new Error('No grades array in response');

  const validIds = new Set(batch.map((b) => b.id));
  const db = createServiceClient();

  let graded = 0;
  for (const g of grades) {
    if (!validIds.has(g.id)) continue; // ignore hallucinated ids

    const impact = clampScore(g.impactScore);
    const category = normalizeCategory(g.category);
    const summary = typeof g.aiSummary === 'string' ? g.aiSummary.trim() : null;

    const { error: gradeErr } = await db.from('grades').insert({
      article_id: g.id,
      impact_score: impact,
      category,
      raw_model_output: g as unknown as Record<string, unknown>,
      is_manual_override: false,
    });
    if (gradeErr) continue;

    await db
      .from('articles')
      .update({ status: 'graded', ai_summary: summary })
      .eq('id', g.id);

    graded++;
  }
  return graded;
}

/** Grade all pending articles, one Gemini call per BATCH_SIZE chunk. */
export async function runGrading(): Promise<GradeResult> {
  const db = createServiceClient();

  // Pull pending articles with their source tier (grading input).
  const { data, error } = await db
    .from('articles')
    .select('id, title, source_excerpt, published_at, sources!inner(name, tier)')
    .eq('status', 'pending')
    .order('published_at', { ascending: false })
    // One batch per invocation: a batch is ~30s and Vercel's Hobby functions
    // hard-cap at 60s. The cron calls this endpoint repeatedly to drain more.
    .limit(BATCH_SIZE);

  if (error) throw new Error(`Failed to load pending articles: ${error.message}`);

  const pending: Gradable[] = (data ?? []).map((row) => {
    // supabase types the embedded relation as an array
    const src = Array.isArray(row.sources) ? row.sources[0] : row.sources;
    return {
      id: row.id,
      title: row.title,
      source_excerpt: row.source_excerpt,
      published_at: row.published_at,
      source_name: src?.name ?? 'Unknown',
      source_tier: src?.tier ?? 3,
    };
  });

  let graded = 0;
  let batches = 0;
  let failedBatches = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    batches++;
    try {
      graded += await gradeBatch(batch);
    } catch {
      failedBatches++; // leave this batch pending for next run
    }
  }

  return { batches, graded, failedBatches };
}
