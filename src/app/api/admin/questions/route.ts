import { NextResponse, type NextRequest } from "next/server";
import { createQuestion } from "@/domain/questions/question-admin-service";
import { questionDraftSchema } from "@/domain/questions/question-draft";
import { requireAdmin } from "@/lib/admin-auth";
import { handleRouteError, readJsonBody } from "@/lib/http";

/** POST /api/admin/questions — add a question (as DRAFT), optionally copied from another. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const body = await readJsonBody(request, questionDraftSchema, 32 * 1024);
    if (!body.ok) return body.response;
    return NextResponse.json(await createQuestion(body.data), { status: 201 });
  } catch (error) {
    return handleRouteError("admin.question_add_failed", error);
  }
}
