import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAdminEnabled, signInAdmin, signOutAdmin } from "@/domain/admin/admin-session";
import { adminCookieName, clearAdminCookie, setAdminCookie } from "@/lib/admin-cookie";
import {
  errorResponse,
  forbiddenCrossOrigin,
  handleRouteError,
  isSameOriginRequest,
  readJsonBody,
} from "@/lib/http";

const signInSchema = z.strictObject({ password: z.string().min(1).max(200) });

/** POST /api/admin/session — admin sign-in. Throttled after repeated failures. */
export async function POST(request: NextRequest) {
  if (!isAdminEnabled()) return errorResponse(404, "NOT_FOUND", "Not found.");
  if (!isSameOriginRequest(request)) return forbiddenCrossOrigin();
  try {
    const body = await readJsonBody(request, signInSchema, 1024);
    if (!body.ok) return body.response;
    const { token, expiresAt } = await signInAdmin(body.data.password);
    const response = new NextResponse(null, { status: 204 });
    setAdminCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    return handleRouteError("admin.login_error", error);
  }
}

/** DELETE /api/admin/session — sign out. */
export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return forbiddenCrossOrigin();
  try {
    await signOutAdmin(request.cookies.get(adminCookieName())?.value);
    const response = new NextResponse(null, { status: 204 });
    clearAdminCookie(response);
    return response;
  } catch (error) {
    return handleRouteError("admin.logout_error", error);
  }
}
