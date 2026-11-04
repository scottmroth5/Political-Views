import { cookies } from "next/headers";
import { resolveSessionToken, type ResolvedSession } from "@/domain/sessions/session-service";
import { sessionCookieName } from "./session-cookie";

/** Session lookup for Server Components (read-only access to cookies). */
export async function getPageSession(): Promise<ResolvedSession> {
  const store = await cookies();
  return resolveSessionToken(store.get(sessionCookieName())?.value);
}
