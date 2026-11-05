import type { PrismaClient } from "@prisma/client";
import {
  committedReviews,
  editorialStatus,
  questionContent,
  type EditorialReview,
} from "./editorial";
import { seedCategories } from "./seed-data";

function canonicalChoices(raw: unknown): string {
  if (!Array.isArray(raw)) return JSON.stringify(raw ?? null);
  return JSON.stringify(
    raw.map((c: { value?: unknown; label?: unknown; exclusive?: unknown }) => [
      c?.value ?? null,
      c?.label ?? null,
      c?.exclusive === true,
    ]),
  );
}

/**
 * Idempotent upsert of the taxonomy by slug. When a question's wording or
 * choices change, its version is incremented so stored responses still record
 * which wording the user saw. Editorial status comes only from the reviews file
 * (prisma/editorial-reviews.json): REVIEWED when a review matches the current
 * wording, otherwise DRAFT.
 */
export async function seedTaxonomy(
  prisma: PrismaClient,
  reviews: readonly EditorialReview[] = committedReviews,
): Promise<{ categories: number; questions: number; reviewed: number }> {
  let reviewedCount = 0;
  let questionCount = 0;

  for (const [categoryIndex, c] of seedCategories.entries()) {
    const category = await prisma.issueCategory.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        label: c.label,
        description: c.description,
        displayOrder: categoryIndex,
      },
      update: { label: c.label, description: c.description, displayOrder: categoryIndex },
    });

    for (const [questionIndex, q] of c.questions.entries()) {
      const topic = await prisma.topic.upsert({
        where: { slug: q.topic.slug },
        create: {
          slug: q.topic.slug,
          label: q.topic.label,
          categoryId: category.id,
          displayOrder: questionIndex,
        },
        update: { label: q.topic.label, categoryId: category.id, displayOrder: questionIndex },
      });

      const content = questionContent(q);
      const status = editorialStatus(q, reviews);
      if (status === "REVIEWED") reviewedCount++;

      const existing = await prisma.question.findUnique({ where: { slug: q.slug } });
      if (!existing) {
        await prisma.question.create({
          data: {
            slug: q.slug,
            topicId: topic.id,
            displayOrder: 0,
            editorialStatus: status,
            ...content,
          },
        });
      } else {
        const changed =
          existing.prompt !== content.prompt ||
          existing.explanationPrompt !== content.explanationPrompt ||
          existing.responseType !== content.responseType ||
          // JSONB does not preserve key order, so compare a canonical form.
          canonicalChoices(existing.choices) !== canonicalChoices(content.choices);
        await prisma.question.update({
          where: { id: existing.id },
          data: {
            topicId: topic.id,
            ...content,
            editorialStatus: status,
            ...(changed ? { version: existing.version + 1 } : {}),
          },
        });
      }
      questionCount++;
    }
  }

  return { categories: seedCategories.length, questions: questionCount, reviewed: reviewedCount };
}
