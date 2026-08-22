---
trigger: always_on
---

---
trigger: always_on
---

# coding-standards.md

Rules for how code is written in this repo. Breaking a rule in the LAWS section
means the task failed, even if the code runs.

## LAWS

1. TypeScript strict mode is on and stays on. Never weaken `tsconfig` strictness
   to make an error go away.
2. Never use `any`. If a type is genuinely unknown, use `unknown` and narrow it.
3. Never use `@ts-ignore` or `@ts-expect-error` to silence a real type error.
   Fix the type instead.
4. Never swallow an error. Every `catch` block must do at least one of:
   rethrow, return a typed error result, or log with enough context to debug
   (job id, book id, image id where relevant). An empty catch is a failed task.
5. Every async path handles rejection. No floating promises. The lint rule for
   floating promises stays enabled.
6. No secrets in code, ever. API keys, database URLs, and webhook secrets are
   read from environment variables only. A committed secret is a failed task
   and must be rotated, not just deleted.
7. Business rules live in `src/domain` as pure functions and every one of them
   has a test. Pricing math, plan limit checks, watermark gating, flag logic:
   if it is a section 3 rule in AGENTS.md, it has a unit test.
8. All numbers that govern behavior (caps, prices, allowances, thresholds,
   the cost ceiling) are read from `src/config`. A literal like `50` or `5000`
   hardcoded in a component, route, or query is a failed task.
9. The build gate is absolute: `tsc` passes with zero errors and the linter
   passes with zero errors before a task is done.
10. Target the current Node LTS. No experimental runtime flags in production
    code.

## GUIDANCE (not laws — the formatter and reviewer settle these)

- Small modules, one job each. Pure functions for logic, side effects at edges.
- Named exports. Clear names over clever names.
- `async`/`await` over raw promise chains.
- Comment the why, not the what. When a line exists because of an AGENTS.md
  rule, name the rule in a short comment.
- Formatting is automated. Do not hand-format or argue style in review.