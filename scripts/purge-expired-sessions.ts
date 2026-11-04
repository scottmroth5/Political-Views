/**
 * Deletes expired anonymous sessions and (via cascade) all of their data.
 * Intended to run on a schedule (e.g. daily) once deployed; see docs/decisions.md.
 */
import { prisma } from "@/lib/db";
import { purgeExpiredSessions } from "@/domain/sessions/session-service";

purgeExpiredSessions()
  .then((count) => console.log(JSON.stringify({ event: "sessions.purged", count })))
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({ event: "sessions.purge_failed", errorName: (error as Error)?.name }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
