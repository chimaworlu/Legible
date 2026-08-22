import { prisma } from "../client";

export const passwordResetCodeRepo = {
  create: async (data: { userId: string; codeHash: string; expiresAt: Date }) => {
    return prisma.passwordResetCode.create({ data });
  },

  findActiveByUser: async (userId: string) => {
    return prisma.passwordResetCode.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  },

  findLatestByUser: async (userId: string) => {
    return prisma.passwordResetCode.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  invalidateActiveForUser: async (userId: string) => {
    return prisma.passwordResetCode.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  },

  incrementAttempts: async (id: string) => {
    return prisma.passwordResetCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  },

  delete: async (id: string) => {
    return prisma.passwordResetCode.delete({ where: { id } });
  },
};
