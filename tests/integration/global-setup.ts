import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { seedTaxonomy } from "../../prisma/seed-taxonomy";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://political_views:local_dev_password@localhost:5433/political_views_test?schema=public";

/** Applies migrations and seeds the taxonomy into the disposable test database. */
export default async function setup() {
  if (!/_test\b|test/.test(new URL(testDatabaseUrl).pathname)) {
    throw new Error(
      "Refusing to run integration tests: TEST_DATABASE_URL must name a test database.",
    );
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });
  const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
  try {
    await prisma.discoverySession.deleteMany();
    await seedTaxonomy(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
