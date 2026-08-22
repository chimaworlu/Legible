import { prisma } from '../client';

export const diagramRepo = {
  // Diagram has no bookId of its own — scoped through the owning source image.
  listStorageKeysForBook: async (bookId: string) => {
    const diagrams = await prisma.diagram.findMany({
      where: { sourceImage: { bookId } },
      select: { storageKey: true }
    });
    return diagrams.map((diagram) => diagram.storageKey);
  },

  listStorageKeysForImage: async (sourceImageId: string) => {
    const diagrams = await prisma.diagram.findMany({
      where: { sourceImageId },
      select: { storageKey: true }
    });
    return diagrams.map((diagram) => diagram.storageKey);
  }
};
