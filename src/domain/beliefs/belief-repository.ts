import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/lib/db";
import type { BeliefValues } from "./belief-schema";

const profileInclude = {
  topic: { include: { category: true } },
  evidence: {
    orderBy: { createdAt: "asc" },
    include: {
      response: {
        include: { question: { select: { id: true, prompt: true, displayOrder: true } } },
      },
    },
  },
} satisfies Prisma.BeliefInclude;

export type BeliefWithSources = Prisma.BeliefGetPayload<{ include: typeof profileInclude }>;

/** Beliefs derived from one guided response, with the choice each came from. */
export async function listDerivedBeliefs(db: Db, sessionId: string, responseId: string) {
  const rows = await db.belief.findMany({
    where: { sessionId, evidence: { some: { responseId, choiceValue: { not: null } } } },
    include: { evidence: { where: { responseId }, select: { choiceValue: true } } },
  });
  return rows.map((b) => ({
    id: b.id,
    status: b.status,
    position: b.position,
    importance: b.importance,
    choiceValue: b.evidence[0]?.choiceValue ?? "",
  }));
}

export function createDerivedBelief(
  db: Db,
  data: {
    sessionId: string;
    topicId: string;
    responseId: string;
    choiceValue: string;
    position: string;
    importance: number | null;
  },
) {
  return db.belief.create({
    data: {
      sessionId: data.sessionId,
      topicId: data.topicId,
      position: data.position,
      importance: data.importance,
      evidence: { create: { responseId: data.responseId, choiceValue: data.choiceValue } },
    },
  });
}

/** Only touches beliefs that are still suggestions, so a concurrent user confirmation wins. */
export function updateSuggestedBelief(
  db: Db,
  id: string,
  data: { position: string; importance: number | null },
) {
  return db.belief.updateMany({
    where: { id, status: "SUGGESTED" },
    data: { ...data, version: { increment: 1 } },
  });
}

export function removeSuggestedBeliefs(db: Db, sessionId: string, ids: string[]) {
  if (ids.length === 0) return Promise.resolve({ count: 0 });
  return db.belief.deleteMany({ where: { id: { in: ids }, sessionId, status: "SUGGESTED" } });
}

export function listSessionBeliefs(sessionId: string): Promise<BeliefWithSources[]> {
  return prisma.belief.findMany({
    where: { sessionId },
    include: profileInclude,
    orderBy: { createdAt: "asc" },
  });
}

export function findSessionBelief(
  sessionId: string,
  id: string,
): Promise<BeliefWithSources | null> {
  return prisma.belief.findFirst({ where: { id, sessionId }, include: profileInclude });
}

/**
 * Applies a user's change if the belief is still at `version` (optimistic concurrency) and records
 * the before and after values. Returns false when someone else changed it first.
 */
export async function updateBeliefByUser(
  sessionId: string,
  id: string,
  version: number,
  previous: BeliefValues,
  next: BeliefValues,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.belief.updateMany({
      where: { id, sessionId, version },
      data: { ...next, version: { increment: 1 } },
    });
    if (count === 0) return false;
    await tx.beliefRevision.create({
      data: {
        beliefId: id,
        actor: "USER",
        previousValue: { ...previous },
        newValue: { ...next },
      },
    });
    return true;
  });
}
