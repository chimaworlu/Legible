import { prisma } from '../client';

export const userRepo = {
  findById: async (id: string) => {
    return prisma.user.findUnique({
      where: { id },
      include: { subscription: true }
    });
  },

  // Emails are stored lowercased at signup (see app/api/auth/signup) —
  // normalize here too so a lookup by a differently-cased email still hits.
  findByEmail: async (email: string) => {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { subscription: true }
    });
  },

  create: async (data: { email: string; name?: string; passwordHash?: string }) => {
    return prisma.user.create({ data });
  },

  delete: async (id: string) => {
    return prisma.user.delete({ where: { id } });
  }
};
