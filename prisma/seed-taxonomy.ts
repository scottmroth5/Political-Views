import type { PrismaClient } from "@prisma/client";
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
 * which wording the user saw. Editorial status is never downgraded by reseeding.
 */
export async function seedTaxonomy(
  prisma: PrismaClient,
): Promise<{ categories: number; questions: number }> {
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

      const content = {
        prompt: q.prompt,
        explanationPrompt: q.explanationPrompt ?? null,
        responseType: q.multiple ? ("MULTI_CHOICE" as const) : ("SINGLE_CHOICE" as const),
        choices: q.choices.map((ch) => ({
          value: ch.value,
          label: ch.label,
          ...(ch.exclusive ? { exclusive: true } : {}),
        })),
      };

      const existing = await prisma.question.findUnique({ where: { slug: q.slug } });
      if (!existing) {
        await prisma.question.create({
          data: { slug: q.slug, topicId: topic.id, displayOrder: 0, ...content },
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
            ...(changed
              ? { version: existing.version + 1, editorialStatus: "DRAFT" as const }
              : {}),
          },
        });
      }
      questionCount++;
    }
  }

  return { categories: seedCategories.length, questions: questionCount };
}
