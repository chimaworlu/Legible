---
name: flutterwave-billing
description: Use this skill whenever touching money. Triggers include Flutterwave, payment, checkout, webhook, subscription, credits, credit balance, transaction, refund, plan upgrade, or watermark gate. Read it before writing a single line of billing code, because the order of operations is the whole game.
---

# Flutterwave Billing

Money code done correctly, every time. The laws live in `money-and-billing.md` and `security.md` rules 5 to 7.

## Steps

1. Verify the webhook signature (verif-hash) before anything else. Unverified: drop, log, 401 (security.md rule 5).
2. Validate the event shape with a zod schema.
3. Check idempotency by provider reference. Already seen: return ok and do nothing. The same letter counts once (security.md rule 6).
4. Apply the state change and write the Transaction ledger row inside one database transaction (money-and-billing.md rules 7 and 12). Convert Naira to kobo once at the boundary; kobo everywhere after (money-and-billing.md rule 1).
5. For subscriptions: completed charges set Subscription.status ACTIVE and advance currentPeriodEnd; failures and cancellations set PAST_DUE or CANCELED, never delete the row (money-and-billing.md rule 11).
6. Grant nothing from client claims. Payment truth is verified webhooks or verified server-side confirmation only (money-and-billing.md rule 11, security.md rule 7).

## Skeletons

Webhook handler, order fixed:

    export async function POST(req: Request) {
      const signature = req.headers.get("verif-hash");
      if (!verifySignature(signature)) {
        log.warn("unverified webhook dropped");
        return new Response(null, { status: 401 });
      }
      const event = webhookSchema.parse(await req.json());

      const seen = await txRepo.findByReference(event.data.tx_ref);
      if (seen) return ok();

      await db.$transaction(async (tx) => {
        await applyEvent(tx, event);
        await txRepo.write(tx, ledgerRowFor(event)); // amountMinor in kobo
      });
      return ok();
    }

Atomic credit spend, check and take in one motion (money-and-billing.md rule 8):

    const updated = await db.user.updateMany({
      where: { id: userId, creditBalance: { gte: cost } },
      data: { creditBalance: { decrement: cost } },
    });
    if (updated.count === 0) throw new InsufficientCredits();
    await txRepo.write({ type: "CREDIT_SPEND", credits: -cost, userId });

Both statements inside one $transaction.

## Traps

- Reordering the webhook steps. Verification before parsing, parsing before lookup, lookup before state change. Any other order creates free money.
- Read-modify-write on a balance. Two simultaneous spends each see 10 left, both take 8, the jar goes negative.
- A balance mutation with no Transaction row. The ledger must always explain the balance.
- Gating the watermark on User.plan or a cached flag. One source of truth: the Subscription row, read fresh (money-and-billing.md rule 10).
- A float, a decimal, or a major-unit Naira value anywhere.

## Verify before done

- [ ] Signature verified before anything else
- [ ] Idempotency by provider reference
- [ ] Every mutation paired with a Transaction row in one $transaction
- [ ] All amounts kobo, whole numbers, currency set
- [ ] Balance ops atomic
- [ ] Benefits read Subscription fresh
- [ ] Tests to write: duplicate webhook grants once; unverified webhook grants nothing; insufficient credits cannot go negative; expired subscription restores the watermark