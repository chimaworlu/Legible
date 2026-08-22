import { prisma } from '../client';

export const bookRepo = {
  findForUser: async (id: string, userId: string) => {
    return prisma.book.findFirst({
      where: { id, userId }
    });
  },

  listForUser: async (userId: string) => {
    return prisma.book.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
  },

  listForUserWithImages: async (userId: string) => {
    return prisma.book.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { images: { select: { id: true } } }
    });
  },

  create: async (data: { title: string; userId: string }) => {
    return prisma.book.create({ data });
  },

  countCreatedSince: async (userId: string, since: Date) => {
    return prisma.book.count({
      where: { userId, createdAt: { gte: since } }
    });
  },

  delete: async (id: string) => {
    return prisma.book.delete({ where: { id } });
  }
};
