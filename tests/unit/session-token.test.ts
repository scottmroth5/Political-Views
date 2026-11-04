import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  isWellFormedSessionToken,
} from "@/domain/sessions/session-token";
import { computeSessionExpiry, isSessionExpired } from "@/domain/sessions/session-policy";

describe("session tokens", () => {
  it("generates unique, well-formed 256-bit tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateSessionToken));
    expect(tokens.size).toBe(100);
    for (const t of tokens) expect(isWellFormedSessionToken(t)).toBe(true);
  });

  it("hashes deterministically and never returns the token itself", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([undefined, null, "", "short", "a".repeat(44), "!".repeat(43)])(
    "rejects malformed token %s",
    (value) => {
      expect(isWellFormedSessionToken(value)).toBe(false);
    },
  );
});

describe("session expiry policy", () => {
  const now = new Date("2026-11-03T12:00:00Z");

  it("expires TTL days after creation", () => {
    expect(computeSessionExpiry(now, 30).toISOString()).toBe("2026-12-03T12:00:00.000Z");
  });

  it("treats the exact expiry instant as expired", () => {
    const expiresAt = computeSessionExpiry(now, 1);
    expect(isSessionExpired(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(false);
    expect(isSessionExpired(expiresAt, expiresAt)).toBe(true);
  });
});
