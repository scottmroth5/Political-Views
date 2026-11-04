const DAY_MS = 24 * 60 * 60 * 1000;

/** Fixed expiry measured from session creation (see docs/decisions.md D-007). */
export function computeSessionExpiry(now: Date, ttlDays: number): Date {
  return new Date(now.getTime() + ttlDays * DAY_MS);
}

export function isSessionExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}
