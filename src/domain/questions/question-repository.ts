import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const servableInclude = {
  topic: { include: { category: true } },
} satisfies Prisma.QuestionInclude;

export type ServableQuestion = Prisma.QuestionGetPayload<{ include: typeof servableInclude }>;

function servableWhere(requireReviewed: boolean): Prisma.QuestionWhereInput {
  return {
    archivedAt: null,
    ...(requireReviewed ? { editorialStatus: "REVIEWED" } : {}),
    topic: { active: true, category: { active: true } },
  };
}

export function listServableQuestions(requireReviewed: boolean): Promise<ServableQuestion[]> {
  return prisma.question.findMany({
    where: servableWhere(requireReviewed),
    include: servableInclude,
  });
}

export function findServableQuestion(
  id: string,
  requireReviewed: boolean,
): Promise<ServableQuestion | null> {
  return prisma.question.findFirst({
    where: { id, ...servableWhere(requireReviewed) },
    include: servableInclude,
  });
}

export async function countActiveCategories(): Promise<number> {
  return prisma.issueCategory.count({ where: { active: true } });
}

export function listActiveCategories() {
  return prisma.issueCategory.findMany({
    where: { active: true },
    select: { id: true, slug: true, label: true, displayOrder: true },
  });
}
