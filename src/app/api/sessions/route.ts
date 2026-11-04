import { NextResponse, type NextRequest } from "next/server";
import { modeInputSchema } from "@/domain/sessions/session-schema";
import {
  changeSessionMode,
  createAnonymousSession,
  resolveSessionToken,
} from "@/domain/sessions/session-service";
import { toSessionDto } from "@/lib/api-session";
import {
  forbiddenCrossOrigin,
  handleRouteError,
  isSameOriginRequest,
  readJsonBody,
} from "@/lib/http";
import { readSessionToken, setSessionCookie } from "@/lib/session-cookie";

/**
 * POST /api/sessions — start anonymously (US-01). If the browser already holds
 * an active session, reuse it (just updating the mode) rather than orphaning it.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return forbiddenCrossOrigin();
  const body = await readJsonBody(request, modeInputSchema);
  if (!body.ok) return body.response;

  try {
    const existing = await resolveSessionToken(readSessionToken(request));
    if (existing.status === "active") {
      const session = await changeSessionMode(existing.session.id, body.data.mode);
      return NextResponse.json({ session: toSessionDto(session), created: false });
    }

    const { session, token } = await createAnonymousSession(body.data.mode);
    const response = NextResponse.json(
      { session: toSessionDto(session), created: true },
      { status: 201 },
    );
    setSessionCookie(response, token, session.expiresAt);
    return response;
  } catch (error) {
    return handleRouteError("session.create_failed", error);
  }
}
