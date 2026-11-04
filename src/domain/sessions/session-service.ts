import type { DiscoveryMode, DiscoverySession } from "@prisma/client";
import { getEnv } from "@/lib/env";
import {
  createSessionRecord,
  deleteSessionRecord,
  deleteSessionsExpiredBefore,
  findSessionByTokenHash,
  updateSessionMode,
} from "./session-repository";
import { computeSessionExpiry, isSessionExpired } from "./session-policy";
import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from "./session-token";

export type ResolvedSession =
  { status: "none" } | { status: "expired" } | { status: "active"; session: DiscoverySession };

export async function createAnonymousSession(
  mode: DiscoveryMode,
  now: Date = new Date(),
): Promise<{ session: DiscoverySession; token: string }> {
  const token = generateSessionToken();
  const session = await createSessionRecord({
    tokenHash: hashSessionToken(token),
    mode,
    expiresAt: computeSessionExpiry(now, getEnv().SESSION_TTL_DAYS),
  });
  return { session, token };
}

/**
 * Maps a cookie token to a session. Expired sessions are deleted on sight so
 * their data is not retained beyond the stated window.
 */
export async function resolveSessionToken(
  token: string | undefined | null,
  now: Date = new Date(),
): Promise<ResolvedSession> {
  if (!isWellFormedSessionToken(token)) return { status: "none" };
  const session = await findSessionByTokenHash(hashSessionToken(token));
  if (!session) return { status: "none" };
  if (isSessionExpired(session.expiresAt, now)) {
    await deleteSessionRecord(session.id);
    return { status: "expired" };
  }
  return { status: "active", session };
}

export function changeSessionMode(sessionId: string, mode: DiscoveryMode) {
  return updateSessionMode(sessionId, mode);
}

export function deleteSession(sessionId: string) {
  return deleteSessionRecord(sessionId);
}

export function purgeExpiredSessions(now: Date = new Date()) {
  return deleteSessionsExpiredBefore(now);
}
