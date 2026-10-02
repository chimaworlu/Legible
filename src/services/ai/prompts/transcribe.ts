// Prompt template for the TRANSCRIBE task, shared by every provider adapter
// (ai-pipeline.md law 9 — versioned in git like code, no realistic student
// data in the text itself). Using the exact same template across adapters is
// what keeps "identical inputs -> identical database writes regardless of
// active provider" (law 3) actually achievable, rather than aspirational.

export const TRANSCRIBE_PROMPT = `You are transcribing a single photo of a handwritten student note page into plain text.

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
