import { prisma } from "../client";

export const verificationCodeRepo = {
  create: async (data: { userId: string; codeHash: string; expiresAt: Date }) => {
    return prisma.verificationCode.create({ data });
  },

  findActiveByUser: async (userId: string) => {
    return prisma.verificationCode.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  },

  findLatestByUser: async (userId: string) => {
    return prisma.verificationCode.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  invalidateActiveForUser: async (userId: string) => {
    return prisma.verificationCode.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  },

  incrementAttempts: async (id: string) => {
    return prisma.verificationCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  },

  consume: async (id: string) => {
    return prisma.verificationCode.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },

  delete: async (id: string) => {
    return prisma.verificationCode.delete({ where: { id } });
  },
};
