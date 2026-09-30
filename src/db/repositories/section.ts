import { prisma } from '../client';
import type { SectionConfidence, FlagType } from '@prisma/client';

export interface NewSectionFlag {
  startOffset: number;
  endOffset: number;
  type: FlagType;
  suggestion?: string;
}

export interface CreateSectionWithFlagsInput {
  bookId: string;
  sourceImageId: string;
  order: number;
  originalText: string;
  confidence: SectionConfidence;
  flags: NewSectionFlag[];
}

export const sectionRepo = {
  // Scoped through bookId (security.md rule 1) — used by the book detail
  // page to render each TRANSCRIBED image's text and flags.
  listForBook: async (bookId: string) => {
    return prisma.section.findMany({
      where: { bookId },
      orderBy: { order: "asc" },
      include: { flags: true },
    });
  },

  // Scoped through sourceImageId, not id alone (security.md rule 1) — the
  // caller already owns the Job row (and therefore the sourceImageId) that
  // led it here.
  findForSourceImage: async (sourceImageId: string) => {
    return prisma.section.findFirst({ where: { sourceImageId } });
  },

  updateSummary: async (id: string, summary: string) => {
    return prisma.section.update({ where: { id }, data: { summary } });
  },

  // One Section + its TranscriptionFlag rows, written atomically — a
  // half-written section (text saved, flags lost) would silently violate
  // R10/R11 (GAP/LOW flags must always land alongside the text they flag).
  createWithFlags: async (input: CreateSectionWithFlagsInput) => {
    return prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          bookId: input.bookId,
          sourceImageId: input.sourceImageId,
          order: input.order,
          originalText: input.originalText,
          confidence: input.confidence,
        },
      });

      if (input.flags.length > 0) {
        await tx.transcriptionFlag.createMany({
          data: input.flags.map((flag) => ({ ...flag, sectionId: section.id })),
        });
      }

      return section;
    });
  },
};
