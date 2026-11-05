import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/domain/profiles/profile-service";
import { requireActiveSession } from "@/lib/api-session";
import { handleRouteError } from "@/lib/http";

/** GET /api/profile — the preliminary profile: beliefs by issue area and question coverage. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveSession(request);
    if (!auth.ok) return auth.response;
    return NextResponse.json(await getProfile(auth.session.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleRouteError("profile.get_failed", error);
  }
}
