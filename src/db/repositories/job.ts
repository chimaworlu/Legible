import { prisma } from '../client';
import type { JobType, JobStatus } from '@prisma/client';

export const jobRepo = {
  // sourceImageId is optional: a book-level job (e.g. EXPORT) has none.
  createMany: async (items: Array<{ userId: string; bookId: string; sourceImageId?: string; type: JobType }>) => {
    return prisma.job.createMany({
      data: items.map((item) => ({ ...item, status: 'QUEUED' as JobStatus })),
    });
  },

  // Worker poll read (worker/index.ts) — the Job table is the v1 interim
  // queue (see src/services/queue's own comment); this is the one read that
  // drives the polling loop.
  listQueuedByType: async (type: JobType, limit: number) => {
    return prisma.job.findMany({
      where: { type, status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  },

  listForBook: async (bookId: string, type: JobType) => {
    return prisma.job.findMany({ where: { bookId, type } });
  },

  // Used to poll a single image's SUMMARIZE job status (there's at most one
  // active at a time per image — the route enforces that before enqueueing).
  findLatestForSourceImage: async (sourceImageId: string, type: JobType) => {
    return prisma.job.findFirst({ where: { sourceImageId, type }, orderBy: { createdAt: "desc" } });
  },

  // Same idea as findLatestForSourceImage, for book-level job types (e.g.
  // EXPORT) that have no sourceImageId — there's at most one active at a
  // time per book, enforced by the route before enqueueing another.
  findLatestForBook: async (bookId: string, type: JobType) => {
    return prisma.job.findFirst({ where: { bookId, type }, orderBy: { createdAt: "desc" } });
  },

  markRunning: async (id: string) => {
    return prisma.job.update({ where: { id }, data: { status: 'RUNNING' as JobStatus, attempts: { increment: 1 } } });
  },

  markSucceeded: async (id: string) => {
    return prisma.job.update({ where: { id }, data: { status: 'SUCCEEDED' as JobStatus, error: null } });
  },

  // error is sanitized by the caller before this is called (ai-pipeline.md
  // law 12 — job id, book id, image id, provider, sanitized message only,
  // never note content).
  markFailed: async (id: string, error: string) => {
    return prisma.job.update({ where: { id }, data: { status: 'FAILED' as JobStatus, error } });
  },
};
