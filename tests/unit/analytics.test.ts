import { describe, expect, it } from "vitest";
import { analyticsEvent, createTracker, pageFromPath, type CapturePayload } from "@/lib/analytics";
import { getAnalyticsConfig } from "@/lib/analytics-config";
import { buildCsp } from "@/middleware";

const config = { token: "phc_testtoken123", distinctId: "id-1" };

describe("analyticsEvent allowlist", () => {
  it("builds a payload with only the allowed property and no person profile", () => {
    expect(analyticsEvent("question_responded", { outcome: "answered" }, config)).toEqual({
      api_key: "phc_testtoken123",
      event: "question_responded",
      distinct_id: "id-1",
      properties: { app: "political_views", $process_person_profile: false, outcome: "answered" },
    });
  });

  it("drops every property that is not on the allowlist (no answers, topics or ids)", () => {
    const body = analyticsEvent(
      "question_responded",
      {
        outcome: "skipped",
        questionId: "abc",
        choiceValues: ["single-payer"],
        topic: "immigration",
        text: "my private view",
      },
      config,
    );
    expect(Object.keys(body!.properties).sort()).toEqual([
      "$process_person_profile",
      "app",
      "outcome",
    ]);
    expect(JSON.stringify(body)).not.toMatch(/single-payer|immigration|private view|abc/);
  });

  it("rejects unknown events and values outside the allowed set", () => {
    expect(analyticsEvent("answer_text", { text: "x" }, config)).toBeNull();
    expect(analyticsEvent("question_responded", { outcome: "supports-x" }, config)).toBeNull();
    expect(analyticsEvent("page_viewed", { page: "/discovery/guided?x=1" }, config)).toBeNull();
  });

  it("sends property-less events without extra fields", () => {
    expect(analyticsEvent("session_deleted", { anything: 1 }, config)!.properties).toEqual({
      app: "political_views",
      $process_person_profile: false,
    });
    // A changed answer says only that one was changed, never which question or what to.
    const changed = analyticsEvent("answer_changed", { questionId: "abc", outcome: "x" }, config);
    expect(changed!.properties).toEqual({ app: "political_views", $process_person_profile: false });
    // A profile review says only what kind of action, never which belief or its wording.
    const reviewed = analyticsEvent(
      "belief_reviewed",
      { action: "edited", position: "my words", beliefId: "abc" },
      config,
    );
    expect(reviewed!.properties).toEqual({
      app: "political_views",
      $process_person_profile: false,
      action: "edited",
    });
    expect(analyticsEvent("belief_reviewed", { action: "my words" }, config)).toBeNull();
    expect(pageFromPath("/profile")).toBe("profile");
  });

  it("maps paths to page names, never sending the path itself", () => {
    expect(pageFromPath("/")).toBe("welcome");
    expect(pageFromPath("/discovery/guided")).toBe("guided");
    expect(pageFromPath("/some/other/path")).toBe("other");
  });
});

describe("createTracker", () => {
  const settings = { host: "https://us.i.posthog.com", token: "phc_testtoken123" };

  function setup(nav: { globalPrivacyControl?: boolean; doNotTrack?: string | null } = {}) {
    const sent: [string, CapturePayload][] = [];
    const tracker = createTracker({
      nav,
      send: (url, body) => sent.push([url, body]),
      randomId: () => "rand",
    });
    return { tracker, sent };
  }

  it("queues events until started, then sends them to the capture endpoint", () => {
    const { tracker, sent } = setup();
    tracker.track("page_viewed", { page: "welcome" });
    expect(sent).toHaveLength(0);
    tracker.start(settings);
    expect(sent).toHaveLength(1);
    expect(sent[0]![0]).toBe("https://us.i.posthog.com/i/v0/e/");
    expect(sent[0]![1].distinct_id).toBe("rand");
  });

  it("sends nothing when not configured", () => {
    const { tracker, sent } = setup();
    tracker.track("page_viewed", { page: "welcome" });
    tracker.start(null);
    tracker.track("guided_finished");
    expect(sent).toHaveLength(0);
  });

  it.each([{ globalPrivacyControl: true }, { doNotTrack: "1" }])(
    "sends and queues nothing when the browser opts out (%o)",
    (nav) => {
      const { tracker, sent } = setup(nav);
      tracker.track("page_viewed", { page: "welcome" });
      tracker.start(settings);
      tracker.track("guided_finished");
      expect(sent).toHaveLength(0);
    },
  );

  it("never throws if sending fails", () => {
    const tracker = createTracker({
      nav: {},
      send: () => {
        throw new Error("blocked");
      },
      randomId: () => "r",
    });
    tracker.start(settings);
    expect(() => tracker.track("guided_finished")).not.toThrow();
  });
});

describe("getAnalyticsConfig", () => {
  it("is off without a valid project token", () => {
    expect(getAnalyticsConfig({})).toBeNull();
    expect(getAnalyticsConfig({ ANALYTICS_TOKEN: "phx_personal_key" })).toBeNull();
  });

  it("defaults to PostHog US and requires an https origin", () => {
    expect(getAnalyticsConfig({ ANALYTICS_TOKEN: "phc_abcdefghij1" })).toEqual({
      host: "https://us.i.posthog.com",
      token: "phc_abcdefghij1",
    });
    for (const host of ["http://us.i.posthog.com", "https://x.example/path", "not a url"]) {
      expect(
        getAnalyticsConfig({
          ANALYTICS_TOKEN: "phc_abcdefghij1",
          ANALYTICS_HOST: host,
        }),
      ).toBeNull();
    }
  });
});

describe("buildCsp", () => {
  it("allows only nonce'd scripts and same-origin connections by default", () => {
    const csp = buildCsp("abc123", { dev: false, analyticsHost: null });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("adds exactly the analytics origin when configured", () => {
    const csp = buildCsp("n", { dev: false, analyticsHost: "https://us.i.posthog.com" });
    expect(csp).toContain("connect-src 'self' https://us.i.posthog.com;");
  });

  it("allows eval only in development (React refresh)", () => {
    expect(buildCsp("n", { dev: true, analyticsHost: null })).toContain("'unsafe-eval'");
  });
});
