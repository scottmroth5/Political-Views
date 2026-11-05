import { randomBytes } from "node:crypto";
import { DomainError } from "@/domain/errors";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { buildChoices, slugify, type QuestionDraft } from "./question-draft";
import { parseChoices, type QuestionChoice } from "./question-types";

/**
 * Admin management of questions (D-025): add, copy, mark reviewed, archive. There is no edit or
 * delete; the database refuses both (Question_immutable trigger).
 */

export interface AdminQuestion {
  id: string;
  slug: string;
  prompt: string;
  explanationPrompt: string | null;
  responseType: "SINGLE_CHOICE" | "MULTI_CHOICE" | "FREE_TEXT";
  choices: QuestionChoice[];
  category: { id: string; label: string; order: number };
  topic: { id: string; label: string };
  status: "draft" | "reviewed" | "archived";
  createdAt: string;
  reviewedAt: string | null;
  archivedAt: string | null;
  responseCount: number;
  copiedFrom: { id: string; prompt: string } | null;
}

export async function listAdminQuestions(): Promise<AdminQuestion[]> {
  const rows = await prisma.question.findMany({
    include: {
      topic: { include: { category: true } },
      copiedFrom: { select: { id: true, prompt: true } },
      _count: { select: { responses: true } },
    },
  });
  return rows
    .map((q) => ({
      id: q.id,
      slug: q.slug,
      prompt: q.prompt,
      explanationPrompt: q.explanationPrompt,
      responseType: q.responseType,
      choices: parseChoices(q.choices),
      category: {
        id: q.topic.category.id,
        label: q.topic.category.label,
        order: q.topic.category.displayOrder,
      },
      topic: { id: q.topic.id, label: q.topic.label },
      status: q.archivedAt
        ? ("archived" as const)
        : q.editorialStatus === "REVIEWED"
          ? ("reviewed" as const)
          : ("draft" as const),
      createdAt: q.createdAt.toISOString(),
      reviewedAt: q.reviewedAt?.toISOString() ?? null,
      archivedAt: q.archivedAt?.toISOString() ?? null,
      responseCount: q._count.responses,
      copiedFrom: q.copiedFrom,
    }))
    .sort(
      (a, b) =>
        a.category.order - b.category.order ||
        a.topic.label.localeCompare(b.topic.label) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

export async function getAdminQuestion(id: string): Promise<AdminQuestion | null> {
  return (await listAdminQuestions()).find((q) => q.id === id) ?? null;
}

/** Categories with their topics, for the new-question form. */
export function listCategoriesWithTopics() {
  return prisma.issueCategory.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      label: true,
      topics: {
        where: { active: true },
        orderBy: { label: "asc" },
        select: { id: true, label: true },
      },
    },
  });
}

/** Adds a new question as DRAFT; with archiveOriginal, archives the question it was copied from. */
export async function createQuestion(draft: QuestionDraft): Promise<{ id: string }> {
  const choices = buildChoices(draft.responseType, draft.choices);
  if (draft.archiveOriginal && !draft.copiedFromId) {
    throw new DomainError("INVALID_QUESTION", "Only a copy can archive its original.", 422);
  }

  return prisma.$transaction(async (tx) => {
    const category = await tx.issueCategory.findFirst({
      where: { id: draft.categoryId, active: true },
    });
    if (!category) throw new DomainError("INVALID_QUESTION", "Choose an issue area.", 422);

    let topicId: string;
    if ("id" in draft.topic) {
      const topic = await tx.topic.findFirst({
        where: { id: draft.topic.id, categoryId: category.id },
      });
      if (!topic)
        throw new DomainError("INVALID_QUESTION", "That topic is not in this issue area.", 422);
      topicId = topic.id;
    } else {
      const label = draft.topic.newLabel;
      const existing = await tx.topic.findFirst({
        where: { categoryId: category.id, label: { equals: label, mode: "insensitive" } },
      });
      if (existing) {
        topicId = existing.id;
      } else {
        const order = await tx.topic.aggregate({
          where: { categoryId: category.id },
          _max: { displayOrder: true },
        });
        const created = await tx.topic.create({
          data: {
            categoryId: category.id,
            label,
            slug: `${slugify(label, 50)}-${randomBytes(3).toString("hex")}`,
            displayOrder: (order._max.displayOrder ?? -1) + 1,
          },
        });
        topicId = created.id;
      }
    }

    if (draft.copiedFromId) {
      const source = await tx.question.findUnique({ where: { id: draft.copiedFromId } });
      if (!source)
        throw new DomainError("INVALID_QUESTION", "The original question was not found.", 422);
    }

    const order = await tx.question.aggregate({ where: { topicId }, _max: { displayOrder: true } });
    const question = await tx.question.create({
      data: {
        topicId,
        slug: `${slugify(draft.prompt, 50)}-${randomBytes(3).toString("hex")}`,
        prompt: draft.prompt,
        explanationPrompt: draft.explanationPrompt || null,
        responseType: draft.responseType,
        choices,
        displayOrder: (order._max.displayOrder ?? -1) + 1,
        copiedFromId: draft.copiedFromId ?? null,
      },
    });

    if (draft.copiedFromId && draft.archiveOriginal) {
      await tx.question.updateMany({
        where: { id: draft.copiedFromId, archivedAt: null },
        data: { archivedAt: new Date() },
      });
    }
    logger.info("admin.question_added", { copied: Boolean(draft.copiedFromId) });
    return { id: question.id };
  });
}

/** Archives a question (no longer asked; answers kept). Archiving twice is harmless. */
export async function archiveQuestion(id: string): Promise<void> {
  const { count } = await prisma.question.updateMany({
    where: { id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (count === 0 && !(await prisma.question.findUnique({ where: { id }, select: { id: true } }))) {
    throw new DomainError("QUESTION_NOT_FOUND", "That question was not found.", 404);
  }
  if (count > 0) logger.info("admin.question_archived", {});
}

/** Marks a draft question reviewed, so production can show it. Cannot be undone; archive instead. */
export async function markQuestionReviewed(id: string): Promise<void> {
  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) throw new DomainError("QUESTION_NOT_FOUND", "That question was not found.", 404);
  if (question.archivedAt) {
    throw new DomainError("QUESTION_ARCHIVED", "Archived questions can't be marked reviewed.", 409);
  }
  if (question.editorialStatus === "REVIEWED") return;
  await prisma.question.updateMany({
    where: { id, editorialStatus: "DRAFT", archivedAt: null },
    data: { editorialStatus: "REVIEWED", reviewedAt: new Date() },
  });
  logger.info("admin.question_reviewed", {});
}
