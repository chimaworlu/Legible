import type { PlanUsageLimits } from "@/src/domain/planLimits";

// Gates that must pass before an AI call fires, in the order ai-pipeline.md
// law 10 specifies: plan allowance -> quality check (src/domain/imageQuality)
// -> cost ceiling. Every gate returns a reason, never a bare boolean, so the
// caller always has a user-facing message (law 10/11 — "never silently
// continue").

export type GateResult = { allowed: true } | { allowed: false; reason: string; action: "pause" | "block" };

// R3/R31 — checked once, up front, before enqueueing a processing batch
// (app/api/books/[bookId]/process). Mirrors the existing
// checkImageUploadAllowance convention in src/domain/planLimits.ts: usage is
// derived by counting rows, never a stored counter.
export function checkPlanAllowance(imagesThisMonth: number, limits: PlanUsageLimits): GateResult {
  if (imagesThisMonth >= limits.imagesPerMonth) {
    return {
      allowed: false,
      action: "block",
      reason: "You've used your plan's monthly image allowance. Upgrade to PRO or wait until next month to process more images.",
    };
  }
  return { allowed: true };
}

// ai-pipeline.md law 10/11, PRD section 6 — "never let a book exceed the
// per-book AI cost ceiling... when a book approaches the ceiling, pause
// processing." Checked per image, immediately before every AI call (not
// just once at enqueue), since sibling images in the same batch can push
// the running total up between enqueue and this image's turn.
export function checkCostCeiling(book: { aiCostSpentMinor: number }, ceilingMinor: number, estimatedCallCostMinor: number): GateResult {
  if (book.aiCostSpentMinor + estimatedCallCostMinor > ceilingMinor) {
    return {
      allowed: false,
      action: "pause",
      reason: "This book has reached its AI processing cost ceiling. Spend credits or upgrade to continue processing.",
    };
  }
  return { allowed: true };
}
