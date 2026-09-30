import type { PlanType } from "@prisma/client";
import { config } from "@/src/config";

export type PlanUsageLimits = {
  imagesPerMonth: number;
  // null means the PRD's provisional tiers (Section 8) don't define a
  // monthly book cap for this plan — PRO only specifies an image
  // allowance and a per-book cap, not a book count. Render as "no cap"
  // rather than inventing a number.
  booksPerMonth: number | null;
  imagesPerBook: number;
  // Per-book AI spend ceiling in kobo (ai-pipeline.md law 10/11) — never
  // let a book's total AI cost exceed this. See src/domain/processingGates.
  bookAiCostCeilingMinor: number;
};

// Plan limits (PRD Section 8, R30). Every number is read from src/config,
// never hardcoded here or at any call site (coding-standards.md law 8).
export function getPlanLimits(plan: PlanType): PlanUsageLimits {
  if (plan === "PRO") {
    return {
      imagesPerMonth: config.plans.PRO.imagesPerMonth,
      booksPerMonth: null,
      imagesPerBook: config.caps.bookImageLimitPro,
      bookAiCostCeilingMinor: config.caps.bookAiCostCeilingMinorPro,
    };
  }

  return {
    imagesPerMonth: config.plans.FREE.imagesPerMonth,
    booksPerMonth: config.plans.FREE.booksAllowance,
    imagesPerBook: config.caps.bookImageLimitFree,
    bookAiCostCeilingMinor: config.caps.bookAiCostCeilingMinorFree,
  };
}

export type BookCreationCheck =
  | { allowed: true }
  | { allowed: false; message: string };

// R31: plan limits are enforced before the action, with a clear message
// naming the limit hit. PRO has no defined monthly book cap (see
// booksPerMonth above), so it's always allowed here.
export function checkBookCreationAllowance(limits: PlanUsageLimits, booksThisMonth: number): BookCreationCheck {
  if (limits.booksPerMonth === null) return { allowed: true };

  if (booksThisMonth >= limits.booksPerMonth) {
    return {
      allowed: false,
      message: `You've reached your plan's limit of ${limits.booksPerMonth} books this month. Upgrade to PRO to create more.`,
    };
  }

  return { allowed: true };
}

export type ImageUploadCheck =
  | { allowed: true }
  | { allowed: false; message: string };

// R3 + R31: plan image caps are enforced at upload time, before anything is
// stored. The per-batch ceiling of 50 is a technical bound in config, not an
// allowance. currentBookImages lets "continue" uploads honor the per-book cap
// against images already in the book.
export function checkImageUploadAllowance(
  limits: PlanUsageLimits,
  imagesThisMonth: number,
  requestedCount: number,
  currentBookImages: number,
): ImageUploadCheck {
  const remainingThisMonth = Math.max(limits.imagesPerMonth - imagesThisMonth, 0);
  if (requestedCount > remainingThisMonth) {
    return {
      allowed: false,
      message: `This upload of ${requestedCount} images exceeds your plan's monthly allowance. You have ${remainingThisMonth} image${remainingThisMonth === 1 ? "" : "s"} left this month. Upgrade to PRO to upload more.`,
    };
  }

  if (currentBookImages + requestedCount > limits.imagesPerBook) {
    return {
      allowed: false,
      message: `A book can hold at most ${limits.imagesPerBook} images on your plan.`,
    };
  }

  return { allowed: true };
}
