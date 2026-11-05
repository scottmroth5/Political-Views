import { Prisma, type Response, type ResponseOutcome } from "@prisma/client";
import { prisma, type Db } from "@/lib/db";

export function findResponseByIdempotencyKey(
  sessionId: string,
  idempotencyKey: string,
): Promise<Response | null> {
  return prisma.response.findUnique({
    where: { sessionId_idempotencyKey: { sessionId, idempotencyKey } },
  });
}

export function findGuidedResponse(
  sessionId: string,
  questionId: string,
): Promise<Response | null> {
  return prisma.response.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
  });
}

export interface GuidedAnswerWrite {
  sessionId: string;
  questionId: string;
  questionVersion: number;
  idempotencyKey: string;
  outcome: ResponseOutcome;
  choiceValues: string[];
  text: string | null;
  importance: number | null;
}

export function createGuidedResponse(data: GuidedAnswerWrite, db: Db = prisma): Promise<Response> {
  return db.response.create({ data: { ...data, mode: "GUIDED" } });
}

/** Editing an answer keeps the same row so belief evidence links stay valid. */
export function updateGuidedResponse(
  id: string,
  data: GuidedAnswerWrite,
  db: Db = prisma,
): Promise<Response> {
  const { outcome, choiceValues, text, importance, questionVersion, idempotencyKey } = data;
  return db.response.update({
    where: { id },
    data: { outcome, choiceValues, text, importance, questionVersion, idempotencyKey },
  });
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function listGuidedResponseSummaries(
  sessionId: string,
): Promise<{ questionId: string; outcome: ResponseOutcome }[]> {
  const rows = await prisma.response.findMany({
    where: { sessionId, questionId: { not: null } },
    select: { questionId: true, outcome: true },
  });
  return rows.flatMap((r) =>
    r.questionId ? [{ questionId: r.questionId, outcome: r.outcome }] : [],
  );
}

export function listGuidedResponsesWithQuestions(sessionId: string) {
  return prisma.response.findMany({
    where: { sessionId, questionId: { not: null } },
    orderBy: { createdAt: "asc" },
    include: { question: { include: { topic: { include: { category: true } } } } },
  });
}
