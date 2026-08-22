---
trigger: glob
---

---
trigger: glob
---

# money-and-billing.md

Rules for anything that touches money, credits, plans, or the watermark.
Every rule is a law. Payments run through Flutterwave only (R32).

## Representation

1. Every amount is a whole number of kobo in `amountMinor`, with an explicit
   `currency` (default `NGN`). Never a float, never a decimal, never a
   major-unit value, anywhere: database, API payloads, config, logs, tests.
2. All arithmetic on money is integer arithmetic. Percentages and margins are
   computed with integer-safe math and an explicit, documented rounding rule.

## Pricing structure

3. No price ever sits below the cost floor: measured cost per image, with
   margin (PRD section 8). Price and allowance values live in `src/config`
   and nowhere else. Never hardcode a price in a component, route, or query.
4. No unlimited anything. Every plan has a bounded monthly image allowance
   and a per-book cap. Adding an uncapped tier or removing a bound is a
   failed task even if a human asks casually — it requires a PRD change first.
5. The per-book AI cost ceiling is enforced in the pipeline. When a book
   approaches the ceiling, processing pauses and the user is asked to spend
   credits or upgrade. Never silently continue past the ceiling.

## Credits and plans

6. Credits are a balance, not a plan. `PlanType` is `FREE` or `PRO` only.
   A PRO user can hold and spend credits.
7. Every credit change writes a `Transaction` row (`CREDIT_PURCHASE` or
   `CREDIT_SPEND`). A balance mutation with no transaction record is a failed
   task — the ledger must always explain the balance.
8. Balance updates are atomic. Use a database transaction or atomic decrement.
   Never read-modify-write a balance in application code. A balance must
   never go negative; the check and the decrement happen in the same
   transaction.
9. Plan limits are enforced at upload time (R3, R31), before any storage or
   AI cost is incurred. The block message tells the user exactly which limit
   they hit.

## Subscription and watermark

10. The watermark gate reads one source of truth: an ACTIVE `Subscription`
    with `currentPeriodEnd` in the future (R25, R34). Never gate on
    `User.plan`, a cached flag, or client state.
11. Subscription state changes come only from verified Flutterwave webhooks
    or verified server-side confirmation. Grant on `charge.completed`-class
    events only after signature verification; handle failure and cancellation
    events by updating `Subscription.status`.
12. Every charge, plan change, and refund writes a `Transaction` row with the
    Flutterwave reference stored in `reference`.

## Refunds and disputes

13. Refunds are recorded, never improvised: a refund writes a transaction,
    adjusts credits or subscription state through the same domain functions
    as any other change, and never leaves the ledger inconsistent with the
    provider's records.