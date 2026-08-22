---
name: ai-provider-adapter
description: Use this skill whenever touching anything inside src/services/ai. Triggers include DeepSeek, Claude, adapter, prompt, confidence mapping, provider switch, AI interface, transcription output, or structured model output. This is the only place provider names may appear, and this manual is how they appear correctly.
---

# AI Provider Adapter

The app talks to one desk: the AiService interface. DeepSeek and Claude sit behind it as adapters. The laws live in `ai-pipeline.md` rules 1 to 9.

## Steps

1. Record two dated human sign-offs as comments at the top of the adapter (ai-pipeline.md rule 5): retention verifiably OFF for this provider (security.md rule 11, PRD section 9), and vision plus span confidence verified on the labeled test set. No sign-offs, no shipping.
2. Put model id, endpoint, temperature, rate limits, and cost rates in src/config, keyed by provider. The adapter reads config and hardcodes nothing (ai-pipeline.md rule 4).
3. Keep prompts in src/services/ai/prompts, versioned like code. Every prompt demands JSON output and states the exact shape. No examples containing realistic student data (ai-pipeline.md rule 9).
4. Parse every response with a zod schema. A response failing validation is a failed call, retried by the job layer, never patched by hand (ai-pipeline.md rule 6).
5. Normalize. Map the provider's native confidence to 0..1. Map its refusals to GAP spans. Two adapters, identical output shape, identical database writes for identical inputs (ai-pipeline.md rule 3).
6. Run the fabrication net after parsing, regardless of provider (R11, ai-pipeline.md rule 7). Convert hits to GAP flags.

## Skeletons

The contract every adapter fulfills (ai-pipeline.md rule 2):

    interface AiService {
      transcribe(image: ImageRef): Promise<TranscriptionResult>;
      caption(region: ImageRef): Promise<CaptionResult>;
      group(sections: SectionSummary[]): Promise<GroupingResult>;
    }

    interface TranscriptionResult {
      text: string;
      spans: { start: number; end: number; confidence: number }[]; // 0..1
      diagramRegions: Region[];
      costMinor: number;  // kobo, from real usage data
    }

The fabrication net, hits become GAP:

    - text present for a region the model marked unreadable
    - any confidence missing or outside 0..1
    - output length wildly inconsistent with the image's detected text area

## Traps

- A provider name, SDK import, or model string outside src/services/ai and config (ai-pipeline.md rule 1). One leak turns a provider swap into a rewrite.
- Trusting the provider's default data settings. Retention is switched off explicitly, never assumed.
- Regexing data out of prose instead of demanding and validating JSON.
- A pipeline stage branching on which provider answered. The desk hides the translator, always.

## Verify before done

- [ ] Both sign-off comments present and dated
- [ ] No model id, URL, or provider constant outside config
- [ ] Zod validation on every response path
- [ ] Confidence normalized, refusals mapped to GAP
- [ ] Fabrication net runs after every transcription
- [ ] Grep the repo for the provider name: matches only inside src/services/ai and config
- [ ] Tests to write: malformed response fails and retries; fabrication signals become GAP flags; both adapters produce identical writes for one fixture input