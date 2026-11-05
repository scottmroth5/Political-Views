import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Admin password hashing with scrypt (memory-hard). Stored format, with no `$` so .env loaders and
 * Docker Compose do not try to expand it:
 *
 *   scrypt:<N>:<r>:<p>:<salt base64url>:<hash base64url>
 *
 * Generate one with `npm run admin:password`.
 */
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 128 * N * R * 2; // scrypt needs ~128·N·r bytes; leave headroom

export const ADMIN_HASH_PATTERN = /^scrypt:\d+:\d+:\d+:[A-Za-z0-9_-]{16,}:[A-Za-z0-9_-]{32,}$/;

export function hashAdminPassword(password: string, salt = randomBytes(16)): string {
  const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join(":");
}

export async function verifyAdminPassword(password: string, stored: string): Promise<boolean> {
  if (!ADMIN_HASH_PATTERN.test(stored)) return false;
  const [, n, r, p, salt, expectedB64] = stored.split(":");
  const expected = Buffer.from(expectedB64!, "base64url");
  const cost = { N: Number(n), r: Number(r), p: Number(p) };
  const actual = await new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password.normalize("NFKC"),
      Buffer.from(salt!, "base64url"),
      expected.length,
      { ...cost, maxmem: 128 * cost.N * cost.r * 2 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
