import type { DiscoveryMode, DiscoverySession } from "@prisma/client";
import { prisma } from "@/lib/db";

export function createSessionRecord(data: {
  tokenHash: string;
  mode: DiscoveryMode;
  expiresAt: Date;
}): Promise<DiscoverySession> {
  return prisma.discoverySession.create({ data });
}

export function findSessionByTokenHash(tokenHash: string): Promise<DiscoverySession | null> {
  return prisma.discoverySession.findUnique({ where: { tokenHash } });
}

export function updateSessionMode(id: string, mode: DiscoveryMode): Promise<DiscoverySession> {
  return prisma.discoverySession.update({ where: { id }, data: { mode } });
}

/** Cascades to responses, beliefs, evidence, revisions and snapshots. */
export async function deleteSessionRecord(id: string): Promise<void> {
  await prisma.discoverySession.deleteMany({ where: { id } });
}

export async function deleteSessionsExpiredBefore(now: Date): Promise<number> {
  const result = await prisma.discoverySession.deleteMany({ where: { expiresAt: { lte: now } } });
  return result.count;
}
