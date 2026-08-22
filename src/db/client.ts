import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const POOL_SIZE = 10;

const globalForPrisma = global as unknown as { prisma: PrismaClient; pgPool: Pool };

const pool = globalForPrisma.pgPool || new Pool({ connectionString: process.env.DATABASE_URL, max: POOL_SIZE });
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
