---
trigger: glob
---

---
trigger: glob
---

# ai-pipeline.md

Rules for every AI call in the system. The provider may be DeepSeek or Claude
(or change between them). These rules are written so that a provider swap is
a config change, never a code change. All AI access flows through the single
service interface in `src/services/ai` (AGENTS.md section 4).

## LAWS — the provider boundary

1. No provider name, SDK import, model string, API URL, or provider-specific
   prompt quirk exists anywhere outside `src/services/ai`. If `deepseek`,
   `anthropic`, `claude`, or a model id appears in a pipeline stage, route,
   component, or domain function, the task failed — even if the feature
   works. The pipeline talks to the interface; only adapters talk to
   providers.
2. The interface defines one typed contract, and every provider adapter
   fulfills it exactly:
   - Input: image reference plus task type (transcribe | caption | group).
   - Output: transcribed text, an array of spans with start offset, end
     offset, and normalized confidence (0 to 1), and detected diagram
     regions.
   An adapter that returns a provider's raw response shape, or a pipeline
   stage that branches on which provider answered, is a failed task.
3. Normalization lives in the adapter. DeepSeek and Claude express
   confidence, refusals, and structure differently; each adapter maps its
   provider's output onto the contract. The pipeline must produce identical
   database writes for identical inputs regardless of active provider.
4. The active provider is selected in `src/config`, nowhere else. Switching
   from DeepSeek to Claude (or back) touches config and, at most, adapter
   code. If a swap requires editing a pipeline stage, the boundary has
   already been broken.
5. Before any provider is enabled (first use or swap), two human sign-offs
   are recorded as comments in the adapter:
   - Retention: training and data retention are verifiably disabled for
     this provider (security.md rule 11; PRD section 9). Never assumed
     from defaults.
   - Capability: the provider handles vision input and yields usable
     span-level confidence for handwriting. A provider that cannot support
     R10 does not ship, however good its price.

## LAWS — structured output and honesty

6. Every AI call requests structured output (JSON with a defined shape) and
   parses it with schema validation. Never regex data out of prose, and
   never trust unvalidated model output. A response that fails validation is
   a failed call, retried per law 12 — never patched by hand in code.
7. Never fabricate. The pipeline never stores text the model did not read
   from the image (R11). Adapters and the validation layer must treat these
   as fabrication signals and convert the affected spans to GAP flags:
   - Text for regions the model marked unreadable
   - Confidence values missing or outside 0 to 1
   - Output length wildly inconsistent with the image's detected text area
   Filling a gap with plausible words is the worst failure in this file,
   and it must be caught the same way whichever provider produced it.
8. Low-confidence spans become `TranscriptionFlag` rows (type LOW) and
   unreadable spans become GAP flags, with offsets (R10, R11). The
   confidence threshold lives in `src/config`, tuned per provider if needed
   — but the threshold value is config, never a constant in a stage.
9. Prompts never include another user's content, secrets, or internal
   config (security.md rule 12). Prompt templates live in
   `src/services/ai/prompts` and are versioned in git like code.

## LAWS — cost gates (every call is money)

10. No AI call fires before its gates pass, in this order:
    - Plan allowance covers the image (R3, R31)
    - The image passed the quality check (R4) — never spend AI cost on an
      image already failed at intake
    - The book is under its AI cost ceiling (PRD section 6)
    A call made before a gate, "to parallelize," is a failed task.
11. Every AI call records its cost against the book, in kobo, from per-call
    usage data. Cost-per-image rates for the active provider live in
    `src/config`. When a book approaches the ceiling, processing pauses and
    the user is asked to spend credits or upgrade — never silently continue.

## LAWS — execution shape

12. AI calls run only inside worker jobs (AGENTS.md section 4): TRANSCRIBE
    per image, STRUCTURE and EXPORT per book. Never call the AI from a
    Next.js route, server action, or component. Failed calls retry with
    exponential backoff up to the config retry limit, then mark the job
    FAILED with a logged, debuggable error — job id, book id, image id,
    provider, and sanitized error, never the note content itself.
13. One image's AI failure never fails the batch. The image is isolated, the
    batch continues to PARTIAL (uploads-and-storage.md rule 8).
14. Topic grouping (Stage 5) never assumes the whole book fits in one model
    context — for either provider. It clusters with per-section embeddings,
    then runs a bounded grouping pass over cluster summaries (PRD section
    6). A single "here is the entire book" call is a failed task at any
    book size, because it works in the demo and breaks at 300 images.
15. Rate limits and concurrency caps per provider live in `src/config`. The
    worker respects them with a limiter, not with hope. Hitting a provider
    429 in a tight retry loop that burns the budget is a failed task.

## GUIDANCE

- Keep prompts short, explicit about the JSON shape, and free of examples
  containing realistic student data.
- Log per-call latency and cost per provider; the v0 slice exists to
  measure exactly this before prices are confirmed.
- When both providers are viable, prefer the one measured cheaper at equal
  accuracy on the labeled test set — measured, not assumed.