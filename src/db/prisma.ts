import { PrismaClient } from '@prisma/client';

const prismaGlobal = globalThis as typeof globalThis & { djsPrisma?: PrismaClient };

export const prisma = prismaGlobal.djsPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.djsPrisma = prisma;
}
