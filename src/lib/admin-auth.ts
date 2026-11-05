import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";
import { isAdminEnabled, isAdminSession } from "@/domain/admin/admin-session";
import { adminCookieName } from "./admin-cookie";
import { errorResponse, forbiddenCrossOrigin, isSameOriginRequest } from "./http";

/**
 * Admin API guard: 404 when admin is turned off (no ADMIN_PASSWORD_HASH), 403 for cross-origin
 * state changes, 401 without a valid admin session.
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!isAdminEnabled())
    return { ok: false, response: errorResponse(404, "NOT_FOUND", "Not found.") };
  if (!isSameOriginRequest(request)) return { ok: false, response: forbiddenCrossOrigin() };
  if (!(await isAdminSession(request.cookies.get(adminCookieName())?.value))) {
    return { ok: false, response: errorResponse(401, "ADMIN_SIGN_IN_REQUIRED", "Please sign in.") };
  }
  return { ok: true };
}

/** Admin page guard: 404 when admin is turned off; sign-in page when not signed in. */
export async function requireAdminPage(): Promise<void> {
  if (!isAdminEnabled()) notFound();
  const store = await cookies();
  if (!(await isAdminSession(store.get(adminCookieName())?.value))) redirect("/admin/login");
}
