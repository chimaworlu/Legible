import { prisma } from '../client';

export const sourceImageRepo = {
  // Scoped through the owning book's userId (database-schema.md law 11 —
  // every query filtering user data must be scoped by the owning user).
  countCreatedSinceForUser: async (userId: string, since: Date) => {
    return prisma.sourceImage.count({
      where: {
        book: { userId },
        createdAt: { gte: since }
      }
    });
  },

  countForBook: async (bookId: string) => {
    return prisma.sourceImage.count({ where: { bookId } });
  },

  createMany: async (bookId: string, items: Array<{ storageKey: string; format: string; imageOrder: number }>) => {
    return prisma.sourceImage.createManyAndReturn({
      data: items.map((item) => ({ bookId, ...item })),
    });
  },

  deleteManyByIds: async (ids: string[]) => {
    return prisma.sourceImage.deleteMany({ where: { id: { in: ids } } });
  },

  listStorageKeysForBook: async (bookId: string) => {
    const images = await prisma.sourceImage.findMany({ where: { bookId }, select: { storageKey: true } });
    return images.map((image) => image.storageKey);
  },

  listForBook: async (bookId: string) => {
    return prisma.sourceImage.findMany({
      where: { bookId },
      orderBy: [{ imageOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, format: true, status: true, imageOrder: true, createdAt: true },
    });
  },

  // Scoped through bookId, not id alone (security.md rule 1).
  findForBook: async (id: string, bookId: string) => {
    return prisma.sourceImage.findFirst({ where: { id, bookId } });
  }
};
