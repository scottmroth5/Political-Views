import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isSameOriginRequest, MAX_JSON_BODY_BYTES, readJsonBody } from "@/lib/http";

const url = "http://localhost:3000/api/x";

describe("isSameOriginRequest", () => {
  it("allows safe methods without an origin", () => {
    expect(isSameOriginRequest(new Request(url))).toBe(true);
  });

  it("allows a POST whose Origin matches the host", () => {
    expect(
      isSameOriginRequest(
        new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" } }),
      ),
    ).toBe(true);
  });

  it("rejects a POST from another origin", () => {
    expect(
      isSameOriginRequest(
        new Request(url, { method: "POST", headers: { origin: "https://evil.example" } }),
      ),
    ).toBe(false);
  });

  it("rejects a state-changing request with no origin evidence", () => {
    expect(isSameOriginRequest(new Request(url, { method: "DELETE" }))).toBe(false);
  });

  it("accepts Sec-Fetch-Site: same-origin when Origin is absent", () => {
    expect(
      isSameOriginRequest(
        new Request(url, { method: "PATCH", headers: { "sec-fetch-site": "same-origin" } }),
      ),
    ).toBe(true);
  });
});

describe("readJsonBody", () => {
  const schema = z.object({ name: z.string() });
  const post = (body: string, contentType = "application/json") =>
    new Request(url, { method: "POST", headers: { "content-type": contentType }, body });

  it("parses and validates JSON", async () => {
    const result = await readJsonBody(post('{"name":"x"}'), schema);
    expect(result).toEqual({ ok: true, data: { name: "x" } });
  });

  it("rejects non-JSON content types", async () => {
    const result = await readJsonBody(post("name=x", "application/x-www-form-urlencoded"), schema);
    expect(result.ok || result.response.status).toBe(415);
  });

  it("rejects oversized bodies", async () => {
    const big = JSON.stringify({ name: "x".repeat(MAX_JSON_BODY_BYTES) });
    const result = await readJsonBody(post(big), schema);
    expect(result.ok || result.response.status).toBe(413);
  });

  it("returns validation errors without echoing submitted values", async () => {
    const result = await readJsonBody(
      post('{"name":"SECRET-BELIEF-TEXT-123"}'),
      z.object({ name: z.number() }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(422);
      expect(await result.response.text()).not.toContain("SECRET-BELIEF-TEXT-123");
    }
  });
});
