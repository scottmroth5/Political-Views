import { NextResponse, type NextRequest } from "next/server";
import { listBeliefs } from "@/domain/beliefs/belief-service";
import { requireActiveSession } from "@/lib/api-session";
import { handleRouteError } from "@/lib/http";

/** GET /api/beliefs — this session's beliefs: suggested, confirmed and rejected, each marked. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveSession(request);
    if (!auth.ok) return auth.response;
    return NextResponse.json(
      { beliefs: await listBeliefs(auth.session.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError("belief.list_failed", error);
  }
}
