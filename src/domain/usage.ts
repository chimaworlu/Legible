// How much of the plan's monthly allowance has been used, e.g. 3 of 3 books
// on FREE = 100%. Not a period-over-period comparison — there's no "last
// month" involved, so there's no divide-by-zero edge case to special-case.
export type UsageStat =
  | { kind: "used"; percent: number }
  | { kind: "empty" }
  // No monthly cap is defined for this metric on this plan (e.g. PRO books),
  // so there's nothing to compute a percentage against.
  | { kind: "uncapped" };

export function computeUsagePercent(current: number, limit: number | null): UsageStat {
  if (limit === null) return { kind: "uncapped" };
  if (current <= 0) return { kind: "empty" };
  return { kind: "used", percent: Math.min(100, Math.round((current / limit) * 100)) };
}
