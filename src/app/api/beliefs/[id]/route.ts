import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { beliefPatchSchema } from "@/domain/beliefs/belief-schema";
import { updateBelief } from "@/domain/beliefs/belief-service";
import { requireActiveSession } from "@/lib/api-session";
import {
  errorResponse,
  forbiddenCrossOrigin,
  handleRouteError,
  isSameOriginRequest,
  readJsonBody,
} from "@/lib/http";

const idSchema = z.uuid();

/**
 * PATCH /api/beliefs/:id — confirm, reject, reword or rate a belief. The body carries the version
 * the user saw; a stale version gets 409 so nobody's change is silently overwritten.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return forbiddenCrossOrigin();
  try {
    const auth = await requireActiveSession(request);
    if (!auth.ok) return auth.response;
    const id = idSchema.safeParse((await params).id);
    if (!id.success) return errorResponse(404, "BELIEF_NOT_FOUND", "That belief was not found.");
    const body = await readJsonBody(request, beliefPatchSchema);
    if (!body.ok) return body.response;
    return NextResponse.json({ belief: await updateBelief(auth.session.id, id.data, body.data) });
  } catch (error) {
    return handleRouteError("belief.update_failed", error);
  }
}
