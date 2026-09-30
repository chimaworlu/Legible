import { prisma } from '../client';
import type { ImageStatus } from '@prisma/client';

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

  // `id` is caller-supplied (not the column's own @default(cuid())) so the
  // same id can be minted before the R2 write and reused as that object's
  // key — see the R2 storage adapter's ownership-encoded key format.
  createMany: async (bookId: string, items: Array<{ id: string; storageKey: string; format: string; imageOrder: number }>) => {
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
      // storageKey is needed by the caller to build a signed R2 preview URL
      // (src/services/storage getSignedReadUrl) — never exposed to the
      // client directly, only the signed URL derived from it.
      select: { id: true, format: true, status: true, imageOrder: true, createdAt: true, storageKey: true },
    });
  },

  // Scoped through bookId, not id alone (security.md rule 1).
  findForBook: async (id: string, bookId: string) => {
    return prisma.sourceImage.findFirst({ where: { id, bookId } });
  },

  updateStatus: async (id: string, status: ImageStatus, qualityScore?: number) => {
    return prisma.sourceImage.update({
      where: { id },
      data: qualityScore === undefined ? { status } : { status, qualityScore },
    });
  },

  // Used for the plan-allowance gate at process time (src/domain/
  // processingGates.checkPlanAllowance) — mirrors countCreatedSinceForUser's
  // existing convention of deriving usage by counting rows, never a stored
  // counter, but scoped to images that actually consumed an AI call.
  countTranscribedSinceForUser: async (userId: string, since: Date) => {
    return prisma.sourceImage.count({
      where: {
        book: { userId },
        status: "TRANSCRIBED",
        createdAt: { gte: since },
      },
    });
  }
};
