import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32; // 256 bits of entropy
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // base64url of 32 bytes, unpadded

/** High-entropy secret placed in the HttpOnly cookie. Never persisted. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Server-side lookup key. A fast hash is appropriate because the token is
 * random (not a password); this prevents DB read access from yielding usable cookies.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedSessionToken(token: string | undefined | null): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}
