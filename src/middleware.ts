import { NextResponse, type NextRequest } from "next/server";
import { getAnalyticsConfig } from "@/lib/analytics-config";

/**
 * Per-request Content-Security-Policy with a nonce. Next.js reads the nonce from the request's
 * CSP header and applies it to its own scripts; no other script can run. connect-src allows this
 * site and, only when analytics is configured, the one PostHog origin.
 */
export function buildCsp(nonce: string, options: { dev: boolean; analyticsHost: string | null }) {
  const connect = ["'self'", ...(options.analyticsHost ? [options.analyticsHost] : [])];
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    analyticsHost: getAnalyticsConfig()?.host ?? null,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  runtime: "nodejs",
  // Pages only: API responses are JSON and static assets need no policy.
  matcher: [{ source: "/((?!api/|_next/static|_next/image|favicon.ico).*)" }],
};
