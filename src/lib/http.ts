import { NextResponse } from "next/server";
import type { z } from "zod";
import { DomainError } from "@/domain/errors";
import { logger } from "./logger";

export const MAX_JSON_BODY_BYTES = 16 * 1024;

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json<ApiErrorBody>(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status },
  );
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Reads a size-limited JSON body and validates it. Never echoes submitted values. */
export async function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<ParseResult<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Expected JSON.") };
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    return {
      ok: false,
      response: errorResponse(413, "PAYLOAD_TOO_LARGE", "Request is too large."),
    };
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return {
      ok: false,
      response: errorResponse(413, "PAYLOAD_TOO_LARGE", "Request is too large."),
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      response: errorResponse(400, "INVALID_JSON", "Request body is not valid JSON."),
    };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // Paths and messages only; never the received values.
    const details = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return {
      ok: false,
      response: errorResponse(422, "VALIDATION_FAILED", "Request validation failed.", details),
    };
  }
  return { ok: true, data: parsed.data };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated routes: state-changing requests must
 * carry an Origin (or Sec-Fetch-Site) proving they come from this site.
 * Combined with SameSite=Lax cookies and JSON-only bodies.
 */
export function isSameOriginRequest(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return host !== null && new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export function forbiddenCrossOrigin() {
  return errorResponse(403, "CROSS_ORIGIN_REJECTED", "Cross-origin request rejected.");
}

export function handleRouteError(event: string, error: unknown) {
  if (error instanceof DomainError) return errorResponse(error.status, error.code, error.message);
  logger.error(event, error);
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}
