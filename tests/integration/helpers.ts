import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

export const BASE = "http://localhost:3000";

interface RequestOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  origin?: string | null;
}

/** Builds a request the way the browser app would send it (same origin, JSON). */
export function apiRequest(path: string, options: RequestOptions = {}): NextRequest {
  const method = options.method ?? "GET";
  const headers = new Headers();
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  const origin = options.origin === undefined ? BASE : options.origin;
  if (origin && method !== "GET") headers.set("origin", origin);
  return new NextRequest(`${BASE}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

/** Extracts "name=value" from a Set-Cookie header for use on follow-up requests. */
export function sessionCookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (!header) throw new Error("Expected a Set-Cookie header");
  return header.split(";")[0]!;
}

export function guidedAnswer(questionId: string, overrides: Record<string, unknown> = {}) {
  return { idempotencyKey: randomUUID(), questionId, outcome: "ANSWERED", ...overrides };
}
