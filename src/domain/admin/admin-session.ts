import { DomainError } from "@/domain/errors";
import {
  generateSessionToken,
  hashSessionToken,
  isWellFormedSessionToken,
} from "@/domain/sessions/session-token";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { verifyAdminPassword } from "./admin-password";

/** Failed sign-ins allowed per window before sign-in pauses (for everyone: there is one admin). */
export const LOGIN_FAILURE_LIMIT = 10;
export const LOGIN_WINDOW_MINUTES = 15;

export function isAdminEnabled(): boolean {
  return getEnv().ADMIN_PASSWORD_HASH !== undefined;
}

/** Checks the password and opens an admin session. Returns the cookie token and expiry. */
export async function signInAdmin(password: string): Promise<{ token: string; expiresAt: Date }> {
  const { ADMIN_PASSWORD_HASH, ADMIN_SESSION_HOURS } = getEnv();
  if (!ADMIN_PASSWORD_HASH) throw new DomainError("NOT_FOUND", "Not found.", 404);

  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000);
  const recentFailures = await prisma.adminLoginFailure.count({
    where: { createdAt: { gte: since } },
  });
  if (recentFailures >= LOGIN_FAILURE_LIMIT) {
    logger.warn("admin.login_throttled", {});
    throw new DomainError(
      "TOO_MANY_ATTEMPTS",
      `Too many failed sign-ins. Try again in ${LOGIN_WINDOW_MINUTES} minutes.`,
      429,
    );
  }

  if (!(await verifyAdminPassword(password, ADMIN_PASSWORD_HASH))) {
    await prisma.adminLoginFailure.create({ data: {} });
    logger.warn("admin.login_failed", {});
    throw new DomainError("INVALID_PASSWORD", "That password is not correct.", 401);
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_HOURS * 3_600_000);
  await prisma.adminSession.create({ data: { tokenHash: hashSessionToken(token), expiresAt } });
  logger.info("admin.login_succeeded", {});
  return { token, expiresAt };
}

/** True when the token belongs to an unexpired admin session (and admin is still enabled). */
export async function isAdminSession(token: string | undefined): Promise<boolean> {
  if (!isAdminEnabled() || !isWellFormedSessionToken(token)) return false;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
  });
  if (!session) return false;
  if (session.expiresAt <= new Date()) {
    await prisma.adminSession.deleteMany({ where: { id: session.id } });
    return false;
  }
  return true;
}

export async function signOutAdmin(token: string | undefined): Promise<void> {
  if (!isWellFormedSessionToken(token)) return;
  await prisma.adminSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

/** Housekeeping for the daily purge: expired admin sessions and day-old failure records. */
export async function purgeAdminRecords(): Promise<{ sessions: number; failures: number }> {
  const now = new Date();
  const [sessions, failures] = await Promise.all([
    prisma.adminSession.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.adminLoginFailure.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - 86_400_000) } },
    }),
  ]);
  return { sessions: sessions.count, failures: failures.count };
}
