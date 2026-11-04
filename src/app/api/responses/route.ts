import { NextResponse, type NextRequest } from "next/server";
import { guidedResponseInputSchema } from "@/domain/responses/response-schema";
import { recordGuidedResponse } from "@/domain/responses/response-service";
import { requireActiveSession } from "@/lib/api-session";
import {
  forbiddenCrossOrigin,
  handleRouteError,
  isSameOriginRequest,
  readJsonBody,
} from "@/lib/http";

/**
 * POST /api/responses — persist (or edit) a guided answer idempotently.
 * Open-conversation messages are added in Milestone 3.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return forbiddenCrossOrigin();
  try {
    const auth = await requireActiveSession(request);
    if (!auth.ok) return auth.response;
    const body = await readJsonBody(request, guidedResponseInputSchema);
    if (!body.ok) return body.response;

    const result = await recordGuidedResponse(auth.session.id, body.data);
    return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 });
  } catch (error) {
    return handleRouteError("response.record_failed", error);
  }
}
