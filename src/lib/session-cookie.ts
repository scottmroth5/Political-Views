import type { NextRequest, NextResponse } from "next/server";

const isProduction = () => process.env.NODE_ENV === "production";

/** `__Host-` prefix (production) forces Secure, Path=/ and no Domain attribute. */
export function sessionCookieName(): string {
  return isProduction() ? "__Host-pv_session" : "pv_session";
}

export function readSessionToken(request: NextRequest): string | undefined {
  return request.cookies.get(sessionCookieName())?.value;
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set({
    name: sessionCookieName(),
    value: token,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: sessionCookieName(),
    value: "",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
