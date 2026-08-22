import { prisma } from '../client';

export const transactionRepo = {
  // security.md rule 6 / flutterwave-billing skill step 3: idempotency by
  // provider reference, checked before applying a webhook event.
  findByReference: async (reference: string) => {
    return prisma.transaction.findFirst({ where: { reference } });
  },

  // The user-facing payment log on /billing (database-schema.md law 11 —
  // scoped by the owning user's id).
  listForUser: async (userId: string) => {
    return prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
  },

  // Used to derive a PRO user's current billing interval (see
  // intervalForAmountMinor) — there's no interval field stored on
  // Subscription itself.
  findLatestSubscriptionCharge: async (userId: string) => {
    return prisma.transaction.findFirst({
      where: { userId, type: "SUBSCRIPTION_CHARGE" },
      orderBy: { createdAt: "desc" }
    });
  }
};
