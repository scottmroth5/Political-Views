/**
 * Deletes expired anonymous sessions and (via cascade) all of their data, plus expired admin
 * sessions and old failed admin sign-in records.
 * Intended to run on a schedule (e.g. daily) once deployed; see docs/decisions.md.
 */
import { prisma } from "@/lib/db";
import { purgeAdminRecords } from "@/domain/admin/admin-session";
import { purgeExpiredSessions } from "@/domain/sessions/session-service";

Promise.all([purgeExpiredSessions(), purgeAdminRecords()])
  .then(([count, admin]) =>
    console.log(
      JSON.stringify({
        event: "sessions.purged",
        count,
        adminSessions: admin.sessions,
        adminLoginFailures: admin.failures,
      }),
    ),
  )
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({ event: "sessions.purge_failed", errorName: (error as Error)?.name }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
