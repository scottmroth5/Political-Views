import { z } from "zod";
import { ADMIN_HASH_PATTERN } from "@/domain/admin/admin-password";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  REQUIRE_REVIEWED_QUESTIONS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Admin pages are turned off entirely (404) unless this is set (npm run admin:password).
  ADMIN_PASSWORD_HASH: z
    .string()
    .regex(ADMIN_HASH_PATTERN)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  ADMIN_SESSION_HOURS: z.coerce.number().int().min(1).max(24).default(12),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validated server environment. Throws with variable names only (never values). */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

/** Tests only: forget the cached environment so a changed process.env takes effect. */
export function resetEnvCacheForTests(): void {
  cached = undefined;
}
