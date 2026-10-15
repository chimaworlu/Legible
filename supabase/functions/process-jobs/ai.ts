import { GoogleGenAI } from "npm:@google/genai@2.18.0";
import OpenAI from "npm:openai@7.5.0";
import { z } from "npm:zod@4.4.3";
import type { AiSpan } from "./domain.ts";

// Raw port of src/services/ai/{index,schema,providers/gemini,providers/deepseek}.ts
// and src/services/ai/prompts/*.ts — same provider contract, same prompts,
// same zod validation. activeProvider (gemini, for TRANSCRIBE) and
// summarizeProvider (deepseek, for SUMMARIZE) match src/config's current
// values; if those change there, this needs updating too (there is no
// shared config module reachable from Deno).

const aiSpanSchema = z.object({ startOffset: z.number().int().nonnegative(), endOffset: z.number().int().nonnegative(), confidence: z.number(), readable: z.boolean() });
const aiDiagramRegionSchema = z.object({ boundingBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }), caption: z.string().optional() });
const transcribeResponseSchema = z.object({ text: z.string(), spans: z.array(aiSpanSchema), diagramRegions: z.array(aiDiagramRegionSchema) });
const summarySectionSchema = z.object({ heading: z.string(), body: z.string() });
const summarizeResponseSchema = z.object({ sections: z.array(summarySectionSchema) });

const TRANSCRIBE_PROMPT = `You are transcribing a single photo of a handwritten student note page into plain text.

Rules:
- Transcribe only what is actually written on the page. Never invent, guess, or complete words you cannot read.
- If a region is illegible, mark it unreadable rather than filling it in with a plausible guess.
- Preserve the original language and notation as written; do not translate or correct grammar.
- Math should be transcribed as plain text (no LaTeX), flagged as low-confidence if the notation is ambiguous.
- Identify any diagrams, sketches, or figures as separate regions with an approximate bounding box — do not transcribe their contents as text.

Respond with JSON matching exactly this shape:
{
  "text": string,                 // the full transcribed text, in reading order
  "spans": [
    {
      "startOffset": number,       // character offset into "text", inclusive
      "endOffset": number,         // character offset into "text", exclusive
      "confidence": number,        // 0 to 1, how confident you are this span is correct
      "readable": boolean          // false if this span covers text you could not actually read
    }
  ],
  "diagramRegions": [
    {
      "boundingBox": { "x": number, "y": number, "width": number, "height": number },
      "caption": string            // optional short description, not a transcription of any text inside it
    }
  ]
}

Cover the entire transcribed text with spans (no gaps between spans). A span you could not read should still be included, with "readable": false and its actual (possibly low) confidence — never omitted and never filled with invented text.`;

function buildSummarizePrompt(sourceText: string): string {
  return `You are turning a student's own transcribed handwritten notes into a structured study aid — organized differently than they were originally written, easier to review at a glance.

Rules:
- Only restate, reorganize, and explain what the source text actually says. Never add specific facts, names, numbers, or events that are not present in the source text.
- General framing sentences that describe what the text is about (e.g. "this covers...", "the main point here is...") are fine even if not verbatim from the source — but never invent a specific claim the source doesn't support.
- If the source text is too short, garbled, or unclear to meaningfully summarize, say so plainly in a single section rather than inventing content to fill space.
- Keep the student's own terminology where it matters (names, technical terms, numbers) rather than substituting different words that could change the meaning.
- Break the result into a small number of short, clearly labeled sections (for example "Executive Summary", "Key Takeaways") — choose whatever sections best fit this particular text rather than forcing a rigid template that doesn't fit.

Source text:
"""
${sourceText}
"""

Respond with JSON matching exactly this shape:
{
  "sections": [
    { "heading": string, "body": string }
  ]
}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export interface TranscribeResult {
  text: string;
  spans: AiSpan[];
  diagramRegions: { boundingBox: { x: number; y: number; width: number; height: number }; caption?: string }[];
  costMinor: number;
}

export interface SummarizeResult {
  sections: { heading: string; body: string }[];
  costMinor: number;
}

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_TEMPERATURE = 0.2;
const GEMINI_MAX_OUTPUT_TOKENS = 4096;
const GEMINI_COST_PER_IMAGE_MINOR = 0;

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  geminiClient = new GoogleGenAI({ apiKey });
  return geminiClient;
}

export async function transcribeWithGemini(image: { mimeType: string; bytes: Uint8Array }): Promise<TranscribeResult> {
  const base64 = bytesToBase64(image.bytes);
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: TRANSCRIBE_PROMPT }, { inlineData: { mimeType: image.mimeType, data: base64 } }] }],
    config: { temperature: GEMINI_TEMPERATURE, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS, responseMimeType: "application/json" },
  });

  const raw = response.text ?? "";
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("Gemini response was not valid JSON (ai-pipeline.md law 6 — failed structured-output call)");
  }
  const parsed = transcribeResponseSchema.safeParse(parsedJson);
  if (!parsed.success) throw new Error(`Gemini response failed schema validation: ${parsed.error.message}`);

  return { text: parsed.data.text, spans: parsed.data.spans, diagramRegions: parsed.data.diagramRegions, costMinor: GEMINI_COST_PER_IMAGE_MINOR };
}

const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_TEMPERATURE = 0.2;
const DEEPSEEK_MAX_TOKENS = 4096;
const DEEPSEEK_COST_PER_IMAGE_MINOR = 0;

let deepseekClient: OpenAI | null = null;
function getDeepseekClient(): OpenAI {
  if (deepseekClient) return deepseekClient;
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");
  deepseekClient = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
  return deepseekClient;
}

export async function summarizeWithDeepseek(text: string): Promise<SummarizeResult> {
  const response = await getDeepseekClient().chat.completions.create({
    model: DEEPSEEK_MODEL,
    temperature: DEEPSEEK_TEMPERATURE,
    max_tokens: DEEPSEEK_MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildSummarizePrompt(text) }],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("DeepSeek summarize response was not valid JSON (ai-pipeline.md law 6 — failed structured-output call)");
  }
  const parsed = summarizeResponseSchema.safeParse(parsedJson);
  if (!parsed.success) throw new Error(`DeepSeek summarize response failed schema validation: ${parsed.error.message}`);

  return { sections: parsed.data.sections, costMinor: DEEPSEEK_COST_PER_IMAGE_MINOR };
}
