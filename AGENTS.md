# AGENTS.md

Rules for the AI coding agent building **Handwritten Notes to Digital Book**.

This file tells you how to behave while building. It does not tell you what to build. The PRD does that. When the two ever seem to conflict, follow this file for behavior and the PRD for scope, and stop and flag the conflict.

---

## 1. What is this project?

A web application that turns photos of handwritten student notes into a clean, structured digital book. A student uploads note images, one at a time or in bulk. A vision model transcribes the handwriting, flags what it cannot read, groups the notes into proposed chapters, and assembles a draft book the student edits and exports to PDF.

- **Users:** university students and self-learners, 15 and over, starting in Nigeria and the wider African market.
- **Version you are building:** v1. A v0 validation slice sits inside early v1 scope and must precede public launch. You build v1 scope only. You do not build v2 or v3.
- **Source of truth:** the PRD, `your-note-prd-v2.md`, version 2.0. Every feature, requirement number (Rn), and data model in this repo traces back to it. If a thing is not in the PRD, it is not in scope.

Read the PRD before you write code. Features go into tasks. Rules go into this file. Do not turn a rule into a feature or a feature into a rule.

---

## 2. What is locked

You must never change, swap, upgrade, or "improve" anything in this section. If you believe something here is wrong, stop and flag it. Do not act on the belief.

### 2.1 Hard-locked stack

- **Framework:** Next.js.
- **Language:** TypeScript.
- **ORM:** Prisma.
- **Database:** PostgreSQL.

Do not introduce a second framework, a second ORM, a second database, or a different language. Do not add a state library, an ORM wrapper, or a query builder on top of Prisma.

### 2.2 Chosen services (defaults set by the team)

Use these. Do not substitute them, even for a service you think is better. The PRD lists alternatives for some of these. An alternative is a human decision, not yours.

- **Object storage:** Cloudflare R2.
- **Queue and worker:** a Redis-backed queue (BullMQ) driving a long-running worker process.
- **Auth:** Auth.js (email plus at least one social login).
- **Payments:** Flutterwave.
- **AI:** one frontier vision-capable LLM, reached only through the single internal AI service interface described in section 4.

### 2.3 Locked database design

The Prisma schema in the PRD is the database design. Follow it exactly.

- Models, enums, relations, and field types match the PRD schema.
- `PlanType` has two values only: `FREE` and `PRO`. Credits are a balance on the user, not a plan. Do not add a `CREDITS` plan value.
- Money lives in `amountMinor` as a whole number of kobo, with an explicit `currency`. See section 3.
- Span-level flags live in `TranscriptionFlag` with `startOffset`, `endOffset`, and `type`. Do not collapse them into a single section-level field.
- `Job` carries an optional `sourceImageId` so transcription runs per image.
- `Diagram` carries `sectionId` and `order` for in-flow placement.

Migrations may add new fields or models when a task needs them. Migrations must never rename, repurpose, or change the meaning of a locked model, enum, or the money representation.

---

## 3. What must never happen

Every line here is an order. Breaking any one of them means the task failed, even if the code builds and the feature works. PRD requirement numbers are cited where they exist.

### Money

- Store every amount as a whole number of the smallest unit, kobo, in `amountMinor`. Never use a float, a decimal, or a Naira-major value for money, anywhere, ever. Always store a `currency` alongside it.
- Never set any price below the measured cost to serve one image. Price per image must sit above the cost floor, with margin (PRD section 8).
- Never create an unlimited plan, an unlimited allowance, or an uncapped book. The subscription carries a bounded monthly image allowance (PRD section 8).
- Never let a book exceed the per-book AI cost ceiling. When a book approaches the ceiling, pause processing and ask the student to spend credits or upgrade. Never silently overspend (PRD section 6).

### Who may use the product

- No minimum sign-up age is enforced (R26 removed by product decision). Do not reintroduce an age gate or age field without a new explicit instruction.
- Do not build the senior secondary persona, parental consent, or a payer-owner split. That is v2. Building it now is out of scope.

### Access, plans, and watermark

- Enforce the student's plan image caps at upload time and block any upload that exceeds the allowance, with a clear message (R3, R31).
- Treat the 50-image batch number as a technical ceiling only, never as a user allowance (R3).
- Apply a visible watermark to every free-plan export. Remove the watermark only when the user has an active PRO subscription, read from the `Subscription` record (R25, R34). Never gate the watermark on anything else.
- Never hardcode a plan limit, a price, a cap, or the cost ceiling in a component, a route, or a query. All of these live in the config module and are read from there (R30).

### AI honesty

- Never output transcription text the model did not read from the image. Never fill gaps with guessed or invented text. Store every unreadable span as a `GAP` flag and every low-confidence span as a `LOW` flag (R10, R11).

### Privacy and data

- Never send user notes to any provider with model training or content retention enabled. The student owns their content and it is never used to train any model.
- When a student deletes a book, delete its sections, flags, diagrams, and original images (R28). When a student deletes their account, delete all of their data (R29). Never leave orphaned images or text behind.

### Payments

- Take payments only through Flutterwave, and support card, bank transfer, and USSD in Naira. Never add a card-only flow that drops the non-card paths (R32).

### Scope and phasing

- Build v1 scope only. Never build a v2 or v3 feature early. That means no LaTeX math, no EPUB export, no in-book search, no sharing or collaboration, no quizzes or flashcards, no native mobile app, and no multilingual transcription. Math in v1 is plain text, flagged low-confidence.
- Never redraw or beautify a diagram. Preserve it as an image with a caption and a recorded position (R12).

---

## 4. How is the work arranged?

Follow this layout. The point of it is physical separation: the request path and the heavy work never share a process.

```
/
├─ AGENTS.md
├─ prisma/
│  ├─ schema.prisma            # the locked schema, mirrors the PRD
│  └─ migrations/
├─ app/                        # Next.js App Router: UI and thin route handlers only
│  ├─ (marketing)/
│  ├─ (app)/                   # authenticated app screens
│  └─ api/                     # thin handlers: enqueue jobs, read status, Flutterwave webhooks
├─ src/
│  ├─ config/                  # ALL limits, caps, prices, cost ceiling, allowances live here
│  ├─ domain/                  # pure business logic: pricing, plan limits, flag rules, watermark rule
│  ├─ db/                      # prisma client and repositories; the only place that touches the DB
│  ├─ services/
│  │  ├─ ai/                   # the single AI service interface + one provider adapter
│  │  ├─ storage/              # R2 adapter; the only place that touches object storage
│  │  ├─ payments/             # Flutterwave adapter
│  │  └─ queue/                # enqueue-only client used by the app
│  └─ lib/                     # shared, dependency-free utilities
├─ worker/                     # dedicated long-running process; runs the whole pipeline
│  ├─ index.ts                 # worker entry point, separate from Next.js
│  ├─ jobs/                    # TRANSCRIBE, STRUCTURE, EXPORT handlers
│  └─ pipeline/
│     └─ stages/               # stage1 intake ... stage7 export
└─ tests/
```

Rules that this layout enforces, and that you must not break:

- The pipeline runs in `worker/` only. Never run transcription, grouping, assembly, or export inside a Next.js request handler or any serverless function (PRD section 6, 7).
- `app/api/` handlers stay thin. They enqueue a job or read status and return. They never do heavy work and never call the AI.
- The queue lives outside the request path. The app enqueues. The worker executes.
- Reach the AI through `src/services/ai` only. No other file imports the model SDK. This is the provider-agnostic boundary.
- Touch object storage through `src/services/storage` only. Store binaries in R2. Store only references and metadata in PostgreSQL. Never write image or PDF bytes into a database column.
- Touch the database through `src/db` repositories only.
- Business rules live in `src/domain` and read numbers from `src/config`. UI never computes a price or a limit itself.

Job granularity, which the code must honor:

- `TRANSCRIBE` runs per image and carries `sourceImageId`. `STRUCTURE` and `EXPORT` run per book.
- A failed image never fails the whole batch. Isolate it, mark it, let the batch reach a `PARTIAL` outcome, and continue.
- Every pipeline stage maps to one of the three job types and writes status to PostgreSQL so the front end can show live progress.

---

## 5. How should the code look?

Clean, readable, modern, and boring. Optimize for the next human who reads it.

- TypeScript in strict mode. No `any`. No `@ts-ignore` to silence a real type error. Type every boundary.
- Target the current Node LTS. Do not use unreleased or experimental runtime features.
- Small modules with one clear job. Pure functions for business logic. Side effects at the edges.
- Named exports. Clear names over clever names. A function name says what it does.
- `async` and `await` over raw promise chains. Handle every error path. Never swallow an error silently.
- No secrets in code. Read them from environment variables. Never commit a key.
- Comment the why, not the what. If a rule from this file drives a piece of code, name the rule in a short comment.
- Keep formatting automatic and consistent through the repo's linter and formatter. Style choices that do not change behavior are preferences, not rules, so let the tooling settle them.
- Write a test for every business rule in section 3. Those rules are the ones most expensive to get wrong.

---

## 6. What counts as done?

A task is done only when all of the following are true. If any line fails, the task is not done, no matter how much works.

- The code builds with zero errors. `tsc` passes with no type errors and the linter passes with no errors. This line is pass or fail on its own.
- Every requirement the task touched is met, cited by its Rn number.
- No rule in section 3 is broken. Confirm each relevant one explicitly.
- No locked choice in section 2 was changed or swapped.
- No v2 or v3 feature was added.
- New business rules have tests, and the tests pass.

End every task with a short checklist in this shape:

```
Task: <name>
Requirements met: R.. , R.. , R..
Section 3 rules checked: <list the ones that applied and confirm each held>
Build: tsc clean, lint clean
Scope: v1 only, no locked choice changed
Notes / open questions: <anything you flagged, or "none">
```

---

## 7. What does the agent do when unsure?

When the PRD does not answer a question, or a task seems to need something outside v1 scope, stop. Do not guess your way forward.

- Never invent a new feature, a new screen, a new model, or a new scope to fill a gap. Absence from the PRD means out of scope, not "your call."
- Never write throwaway or spaghetti code to get past a blocker. A quick hack that violates the layout or a section 3 rule is worse than a paused task.
- Never swap a locked choice to make a problem easier.
- Make the smallest change that satisfies the PRD and this file. If two readings are possible, choose the one that keeps scope smaller and rules intact.
- If the blocker is a real open decision, write it down as a flagged note in your task output and point to the matching item in PRD section 14, Open Questions, if one exists. Then wait for a human answer rather than deciding for them.

When in doubt, do less, keep it clean, and ask.