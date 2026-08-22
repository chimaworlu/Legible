import { Prisma } from "@prisma/client";
import { prisma } from "../client";

export type PaymentLogInput = {
  source: "CHECKOUT" | "WEBHOOK" | "CALLBACK" | "DASHBOARD";
  eventType: string;
  outcome: string;
  userId?: string | null;
  txRef?: string | null;
  transactionId?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  payload?: Prisma.InputJsonValue | null;
};

export const paymentLogRepo = {
  create: async (input: PaymentLogInput) => {
    // Prisma's optional Json field wants the field omitted (or Prisma.JsonNull)
    // rather than a plain `null` to mean "no payload" — normalize here so
    // callers can just pass `null`/`undefined` naturally.
    return prisma.paymentLog.create({ data: { ...input, payload: input.payload ?? undefined } });
  },

  listForUser: async (userId: string) => {
    return prisma.paymentLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  },

  listRecent: async (limit = 100) => {
    return prisma.paymentLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  }
};
