/**
 * Server-side PostHog settings. Off unless ANALYTICS_TOKEN is a PostHog project token (phc_...)
 * and ANALYTICS_HOST (default https://us.i.posthog.com) is an https origin. Read without the
 * strict app env so it works while pages are prerendered at build time.
 */
export interface AnalyticsConfig {
  host: string;
  token: string;
}

export const DEFAULT_ANALYTICS_HOST = "https://us.i.posthog.com";

export function getAnalyticsConfig(
  env: Record<string, string | undefined> = process.env,
): AnalyticsConfig | null {
  const token = env.ANALYTICS_TOKEN?.trim();
  if (!token || !/^phc_[A-Za-z0-9_-]{10,}$/.test(token)) return null;
  let host: URL;
  try {
    host = new URL(env.ANALYTICS_HOST?.trim() || DEFAULT_ANALYTICS_HOST);
  } catch {
    return null;
  }
  if (host.protocol !== "https:" || host.pathname !== "/" || host.search || host.username) {
    return null;
  }
  return { host: host.origin, token };
}
