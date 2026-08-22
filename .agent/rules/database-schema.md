---
trigger: glob
---

---
trigger: glob
---

# database-schema.md

Rules for the Prisma schema and all migrations. The schema in the PRD
(section 10) is the design. This file governs how it may and may not evolve.

## LAWS

1. The PRD schema is locked. Never rename, repurpose, or change the meaning of
   an existing model, enum, or field. Additive changes only, and only when a
   task requires them.
2. `PlanType` has exactly two values: `FREE` and `PRO`. Never add a plan value
   for credits. Credits are a balance (`User.creditBalance`), not a plan.
3. Money is stored as `amountMinor Int` in kobo with an explicit `currency`
   field. Never add a money field as Float, Decimal, or major-unit integer.
   Any new money-bearing model follows the same pattern.
4. Span-level transcription flags live in `TranscriptionFlag` with
   `startOffset`, `endOffset`, and `type` (`LOW` | `GAP`). Never collapse flags
   into a section-level field. R10, R11, and R19 depend on this shape.
5. `Job` keeps its optional `sourceImageId`. TRANSCRIBE jobs are per image.
   STRUCTURE and EXPORT are per book. Never restructure jobs to per-book-only.
6. `Diagram` keeps `sectionId` and `order`. In-flow diagram placement (R12,
   R23) depends on it.
7. Subscription state is read from the `Subscription` model (`status`,
   `currentPeriodEnd`). The watermark gate (R25, R34) reads this model and
   nothing else. Never gate on `User.plan` alone.
8. Deletion cascades are sacred. Deleting a book removes its sections, flags,
   diagrams, and source image records (R28). Deleting a user removes all their
   data (R29). Never add a relation that breaks the cascade chain, and never
   set a relation to `Restrict` where the PRD requires delete-through.
9. Binary data never enters PostgreSQL. No image bytes, no PDF bytes, no
   base64 blobs in any column. Only storage keys and metadata (AGENTS.md
   section 4).
10. Migrations are forward-only and non-destructive by default. A migration
    that drops a table or column, or changes a column type with data loss,
    requires an explicit human sign-off recorded in the migration file as a
    comment. Never run a destructive migration on your own judgment.
11. Every new query path that filters user data must be scoped by the owning
    user's id. No unscoped reads of another user's books, images, or flags.

## GUIDANCE

- Add indexes for every new foreign key and any field used in a hot filter.
- Prefer enums over free-text status strings.
- Name new fields to match the existing style of the locked schema.