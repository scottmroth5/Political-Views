import { PrismaClient } from "@prisma/client";
import { seedTaxonomy } from "./seed-taxonomy";

const prisma = new PrismaClient();

seedTaxonomy(prisma)
  .then(({ categories, questions, reviewed }) => {
    console.log(
      `Seeded ${categories} categories and ${questions} questions (${reviewed} editorially reviewed).`,
    );
  })
  .catch((error: unknown) => {
    console.error("Seeding failed:", error instanceof Error ? error.name : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
