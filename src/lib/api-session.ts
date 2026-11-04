import type { DiscoverySession } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";
import { resolveSessionToken } from "@/domain/sessions/session-service";
import { errorResponse } from "./http";
import { clearSessionCookie, readSessionToken } from "./session-cookie";

type Result = { ok: true; session: DiscoverySession } | { ok: false; response: NextResponse };

/** Server-side authorization: every session-scoped route goes through here. */
export async function requireActiveSession(request: NextRequest): Promise<Result> {
  const resolved = await resolveSessionToken(readSessionToken(request));
  if (resolved.status === "active") return { ok: true, session: resolved.session };

  const response =
    resolved.status === "expired"
      ? errorResponse(401, "SESSION_EXPIRED", "Your session has expired. Please start a new one.")
      : errorResponse(401, "NO_SESSION", "No active session. Please start a new one.");
  clearSessionCookie(response);
  return { ok: false, response };
}

export function toSessionDto(session: DiscoverySession) {
  return {
    mode: session.mode,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}
