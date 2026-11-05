import type { NextResponse } from "next/server";

const isProduction = () => process.env.NODE_ENV === "production";

/** Separate from the anonymous session cookie. SameSite=Strict: never sent on cross-site requests. */
export function adminCookieName(): string {
  return isProduction() ? "__Host-pv_admin" : "pv_admin";
}

export function setAdminCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set({
    name: adminCookieName(),
    value: token,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export function clearAdminCookie(response: NextResponse): void {
  response.cookies.set({
    name: adminCookieName(),
    value: "",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
