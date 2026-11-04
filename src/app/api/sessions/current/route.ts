import { NextResponse, type NextRequest } from "next/server";
import { getNextQuestion } from "@/domain/questions/question-service";
import { modeInputSchema } from "@/domain/sessions/session-schema";
import { changeSessionMode, deleteSession } from "@/domain/sessions/session-service";
import { requireActiveSession, toSessionDto } from "@/lib/api-session";
import {
  forbiddenCrossOrigin,
  handleRouteError,
  isSameOriginRequest,
  readJsonBody,
} from "@/lib/http";
import { clearSessionCookie } from "@/lib/session-cookie";

/** GET /api/sessions/current — session, mode and progress (US-04). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveSession(request);
    if (!auth.ok) return auth.response;
    const { progress } = await getNextQuestion(auth.session.id);
    return NextResponse.json({ session: toSessionDto(auth.session), progress });
  } catch (error) {
    return handleRouteError("session.read_failed", error);
  }
}

/** PATCH /api/sessions/current — switch discovery mode without losing state (US-03). */
export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) return forbiddenCrossOrigin();
  try {
    const auth = await requireActiveSession(request);
    if (!auth.ok) return auth.response;
    const body = await readJsonBody(request, modeInputSchema);
    if (!body.ok) return body.response;
    const session = await changeSessionMode(auth.session.id, body.data.mode);
    return NextResponse.json({ session: toSessionDto(session) });
  } catch (error) {
    return handleRouteError("session.mode_change_failed", error);
  }
}

/** DELETE /api/sessions/current — delete the session and all associated data (US-28-30). */
export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return forbiddenCrossOrigin();
  try {
    const auth = await requireActiveSession(request);
    if (!auth.ok) return auth.response;
    await deleteSession(auth.session.id);
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleRouteError("session.delete_failed", error);
  }
}
