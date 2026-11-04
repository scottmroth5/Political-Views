/**
 * Redacting logger. Political beliefs are sensitive (PRD §10, US-32):
 * never pass request bodies, response text, choices, or error messages that may
 * embed user content. Only event names and coarse, non-identifying metadata.
 */
type Meta = Record<string, string | number | boolean | null | undefined>;

function errorShape(error: unknown): Meta {
  if (error && typeof error === "object") {
    const e = error as { name?: unknown; code?: unknown };
    return {
      errorName: typeof e.name === "string" ? e.name : "UnknownError",
      errorCode: typeof e.code === "string" ? e.code : undefined,
    };
  }
  return { errorName: typeof error };
}

export const logger = {
  info(event: string, meta: Meta = {}) {
    console.info(JSON.stringify({ level: "info", event, ...meta }));
  },
  warn(event: string, meta: Meta = {}) {
    console.warn(JSON.stringify({ level: "warn", event, ...meta }));
  },
  error(event: string, error: unknown, meta: Meta = {}) {
    console.error(JSON.stringify({ level: "error", event, ...meta, ...errorShape(error) }));
  },
};
