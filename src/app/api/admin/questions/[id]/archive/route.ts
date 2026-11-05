import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { archiveQuestion } from "@/domain/questions/question-admin-service";
import { requireAdmin } from "@/lib/admin-auth";
import { errorResponse, handleRouteError } from "@/lib/http";

/** POST /api/admin/questions/:id/archive — archive a question: it is no longer asked; existing answers stay. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const id = z.uuid().safeParse((await params).id);
    if (!id.success)
      return errorResponse(404, "QUESTION_NOT_FOUND", "That question was not found.");
    await archiveQuestion(id.data);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError("admin.question_archive_failed", error);
  }
}
