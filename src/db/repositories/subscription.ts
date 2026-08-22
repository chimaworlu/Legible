import { prisma } from '../client';

export const subscriptionRepo = {
  findByUserId: async (userId: string) => {
    return prisma.subscription.findUnique({ where: { userId } });
  }
};
