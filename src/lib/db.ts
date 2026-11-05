import { PrismaClient, type Prisma } from "@prisma/client";

/** The client, or a transaction, so repository functions can join a caller's transaction. */
export type Db = PrismaClient | Prisma.TransactionClient;

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Query logging is intentionally off: queries carry user political content.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
