import { GoogleGenAI } from '@google/genai';

/**
 * Gemini client (free tier). Used only by the grading job.
 * We ask for JSON output (responseMimeType) and parse defensively —
 * a batch that fails to parse is left `pending` for the next run.
 */
let client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return client;
}

// `gemini-flash-latest` is the rolling free-tier Flash alias; pinned ids like
// `gemini-2.0-flash` can carry a 0 free-tier quota on some projects.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
