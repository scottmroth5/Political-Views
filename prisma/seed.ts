import { PrismaClient } from "@prisma/client";
import { seedTaxonomy } from "./seed-taxonomy";

const prisma = new PrismaClient();

seedTaxonomy(prisma)
  .then(({ categories, questionsAdded, questionsExisting }) => {
    console.log(
      `Seeded ${categories} categories; added ${questionsAdded} questions (${questionsExisting} already present, left unchanged).`,
    );
  })
  .catch((error: unknown) => {
    console.error("Seeding failed:", error instanceof Error ? error.name : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
