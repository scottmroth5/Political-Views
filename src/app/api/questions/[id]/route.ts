import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getQuestionForEdit } from "@/domain/questions/question-service";
import { requireActiveSession } from "@/lib/api-session";
import { errorResponse, handleRouteError } from "@/lib/http";

const idSchema = z.uuid();

/** GET /api/questions/:id — one question plus this session's earlier answer, for editing. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireActiveSession(request);
    if (!auth.ok) return auth.response;
    const id = idSchema.safeParse((await params).id);
    const result = id.success ? await getQuestionForEdit(auth.session.id, id.data) : null;
    if (!result) return errorResponse(404, "QUESTION_NOT_FOUND", "That question is not available.");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleRouteError("question.get_failed", error);
  }
}
