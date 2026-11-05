import type { PrismaClient } from "@prisma/client";
import { seedCategories } from "./seed-data";

/**
 * Loads the starting taxonomy. Categories are upserted by slug (labels and order follow the seed).
 * Questions live in the database and are managed in the admin pages (D-025): seeding only inserts a
 * seed question whose slug is missing, as DRAFT, and never changes or re-adds existing ones, even
 * archived ones.
 */
export async function seedTaxonomy(
  prisma: PrismaClient,
): Promise<{ categories: number; questionsAdded: number; questionsExisting: number }> {
  let questionsAdded = 0;
  let questionsExisting = 0;

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
      if (await prisma.question.findUnique({ where: { slug: q.slug }, select: { id: true } })) {
        questionsExisting++;
        continue;
      }
      const topic =
        (await prisma.topic.findUnique({ where: { slug: q.topic.slug } })) ??
        (await prisma.topic.create({
          data: {
            slug: q.topic.slug,
            label: q.topic.label,
            categoryId: category.id,
            displayOrder: questionIndex,
          },
        }));
      await prisma.question.create({
        data: {
          slug: q.slug,
          topicId: topic.id,
          prompt: q.prompt,
          explanationPrompt: q.explanationPrompt ?? null,
          responseType: q.multiple ? "MULTI_CHOICE" : "SINGLE_CHOICE",
          choices: q.choices.map((ch) => ({
            value: ch.value,
            label: ch.label,
            ...(ch.exclusive ? { exclusive: true } : {}),
          })),
        },
      });
      questionsAdded++;
    }
  }

  return { categories: seedCategories.length, questionsAdded, questionsExisting };
}
