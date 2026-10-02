// Prompt template for the SUMMARIZE task, shared by every provider adapter
// (ai-pipeline.md law 9). This is a distinct, on-demand feature from
// TRANSCRIBE — it restates/reorganizes already-transcribed text as a study
// aid, and is never stored in or displayed as the literal transcript. It
// still carries the pipeline's no-fabrication spirit: a summary that
// invents facts, names, or events the source text doesn't contain is a
// failed call, exactly like a fabricated transcription would be.

export function buildSummarizePrompt(sourceText: string): string {
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
