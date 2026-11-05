/**
 * Privacy-safe product analytics (PostHog), modelled on Health-Review's demo analytics.
 *
 * No SDK: each event is one POST to PostHog's capture endpoint, built field by field from the
 * allowlist below, so nothing else can leave the browser. Never sent: answers, choices, question
 * ids or topics, free text, URLs, referrers, cookies or storage. A random id per page load and no
 * person profiles, so visits are not linked to each other or to the discovery session.
 * Global Privacy Control or Do Not Track: nothing is sent or queued. No config: nothing is sent.
 */

export const APP = "political_views";

export const PAGES = ["welcome", "guided", "conversation", "profile", "privacy", "other"] as const;
export type AnalyticsPage = (typeof PAGES)[number];

type Rule = readonly [property: string, allowed: readonly string[]] | null;

/** Each event and the single property it may carry, with its allowed values. */
const EVENTS: Record<string, Rule> = {
  page_viewed: ["page", PAGES],
  discovery_started: ["mode", ["guided", "conversation"]],
  // How the user responded, never to what: no question, topic or choice is sent.
  question_responded: ["outcome", ["answered", "unsure", "skipped"]],
  // That an earlier answer was changed; not which one, or to what.
  answer_changed: null,
  // What kind of review action, never which belief or its wording.
  belief_reviewed: ["action", ["confirmed", "rejected", "edited", "rated"]],
  mode_switched: ["to", ["guided", "conversation"]],
  guided_finished: null,
  session_deleted: null,
};

export type AnalyticsEventName = keyof typeof EVENTS;

export interface CapturePayload {
  api_key: string;
  event: string;
  distinct_id: string;
  properties: Record<string, string | boolean>;
}

/** The capture payload, or null when the event or its property value is not on the allowlist. */
export function analyticsEvent(
  name: string,
  props: Record<string, unknown> | undefined,
  config: { token: string; distinctId: string },
): CapturePayload | null {
  if (!Object.hasOwn(EVENTS, name)) return null;
  const properties: Record<string, string | boolean> = {
    app: APP,
    $process_person_profile: false,
  };
  const rule = EVENTS[name];
  if (rule) {
    const [key, allowed] = rule;
    const value = props?.[key];
    if (typeof value !== "string" || !allowed.includes(value)) return null;
    properties[key] = value;
  }
  return { api_key: config.token, event: name, distinct_id: config.distinctId, properties };
}

export function pageFromPath(pathname: string): AnalyticsPage {
  if (pathname === "/") return "welcome";
  if (pathname === "/discovery/guided") return "guided";
  if (pathname === "/discovery/conversation") return "conversation";
  if (pathname === "/profile") return "profile";
  if (pathname === "/privacy") return "privacy";
  return "other";
}

interface TrackerDeps {
  nav?: { globalPrivacyControl?: boolean; doNotTrack?: string | null } | undefined;
  send?: (url: string, body: CapturePayload) => void;
  randomId?: () => string;
}

export function createTracker({
  nav = typeof navigator === "undefined" ? undefined : navigator,
  send = post,
  randomId = () => crypto.randomUUID(),
}: TrackerDeps = {}) {
  let config: { url: string; token: string; distinctId: string } | null = null;
  let off = nav?.globalPrivacyControl === true || nav?.doNotTrack === "1";
  const early: [string, Record<string, unknown> | undefined][] = [];

  const track = (name: AnalyticsEventName, props?: Record<string, unknown>) => {
    if (off) return;
    if (!config) {
      if (early.length < 10) early.push([name, props]);
      return;
    }
    try {
      const body = analyticsEvent(name, props, config);
      if (body) send(config.url, body);
    } catch {
      /* analytics never breaks the page */
    }
  };

  return {
    /** Turns sending on with { host, token }; null or missing values turn it off for good. */
    start(settings: { host: string; token: string } | null) {
      if (config || off) {
        early.length = 0;
        return;
      }
      const queued = early.splice(0);
      if (!settings?.host || !settings.token) {
        off = true;
        return;
      }
      config = { url: `${settings.host}/i/v0/e/`, token: settings.token, distinctId: randomId() };
      for (const [name, props] of queued) track(name, props);
    },
    track,
  };
}

function post(url: string, body: CapturePayload) {
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    keepalive: true,
  }).catch(() => {});
}

// The page's one tracker.
const tracker = createTracker();
export const startAnalytics = (settings: { host: string; token: string } | null) =>
  tracker.start(settings);
export const track = (name: AnalyticsEventName, props?: Record<string, unknown>) =>
  tracker.track(name, props);
