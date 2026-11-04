import { NextResponse, type NextRequest } from "next/server";
import { getNextQuestion } from "@/domain/questions/question-service";
import { requireActiveSession } from "@/lib/api-session";
import { handleRouteError } from "@/lib/http";

/** GET /api/questions/next — next eligible curated question, or null when exhausted. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveSession(request);
    if (!auth.ok) return auth.response;
    return NextResponse.json(await getNextQuestion(auth.session.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleRouteError("question.next_failed", error);
  }
}
