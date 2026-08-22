import { prisma } from '../client';
import type { JobType, JobStatus } from '@prisma/client';

export const jobRepo = {
  createMany: async (items: Array<{ userId: string; bookId: string; sourceImageId: string; type: JobType }>) => {
    return prisma.job.createMany({
      data: items.map((item) => ({ ...item, status: 'QUEUED' as JobStatus })),
    });
  }
};
