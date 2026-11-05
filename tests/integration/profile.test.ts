import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as createSession } from "@/app/api/sessions/route";
import { DELETE as deleteCurrent } from "@/app/api/sessions/current/route";
import { POST as postResponse } from "@/app/api/responses/route";
import { GET as listBeliefs } from "@/app/api/beliefs/route";
import { PATCH as patchBelief } from "@/app/api/beliefs/[id]/route";
import { GET as getProfile } from "@/app/api/profile/route";
import type { BeliefDto } from "@/domain/beliefs/belief-service";
import type { ProfileDto } from "@/domain/profiles/profile-builder";
import { prisma } from "@/lib/db";
import { apiRequest, guidedAnswer, sessionCookieFrom } from "./helpers";

async function startSession() {
  const res = await createSession(
    apiRequest("/api/sessions", { method: "POST", body: { mode: "GUIDED" } }),
  );
  return sessionCookieFrom(res);
}

async function answer(cookie: string, body: Record<string, unknown>) {
  const res = await postResponse(apiRequest("/api/responses", { method: "POST", cookie, body }));
  expect(res.status).toBeLessThan(300);
}

async function beliefs(cookie: string): Promise<BeliefDto[]> {
  const res = await listBeliefs(apiRequest("/api/beliefs", { cookie }));
  expect(res.status).toBe(200);
  return (await res.json()).beliefs;
}

function patch(cookie: string, id: string, body: Record<string, unknown>, origin?: string | null) {
  return patchBelief(apiRequest(`/api/beliefs/${id}`, { method: "PATCH", cookie, body, origin }), {
    params: Promise.resolve({ id }),
  });
}

async function profile(cookie: string): Promise<ProfileDto> {
  const res = await getProfile(apiRequest("/api/profile", { cookie }));
  expect(res.status).toBe(200);
  return res.json();
}

/** A multi-select question with at least three non-exclusive choices. */
async function multiQuestion() {
  const all = await prisma.question.findMany({
    where: { responseType: "MULTI_CHOICE", archivedAt: null },
    orderBy: { slug: "asc" },
  });
  for (const q of all) {
    const choices = (q.choices as { value: string; label: string; exclusive?: boolean }[]).filter(
      (c) => !c.exclusive,
    );
    if (choices.length >= 3) return { id: q.id, prompt: q.prompt, choices };
  }
  throw new Error("Seed data should include a multi-select question with three choices");
}

beforeEach(async () => {
  await prisma.discoverySession.deleteMany();
});

afterAll(async () => {
  await prisma.discoverySession.deleteMany();
  await prisma.$disconnect();
});

describe("beliefs suggested from guided answers", () => {
  it("suggests one belief per selected choice, linked to the answer, worded as the choice", async () => {
    const cookie = await startSession();
    const q = await multiQuestion();
    const [a, b] = q.choices;
    await answer(
      cookie,
      guidedAnswer(q.id, { choiceValues: [a!.value, b!.value], importance: 4, text: "Because." }),
    );

    const list = await beliefs(cookie);
    expect(list.map((x) => x.position).sort()).toEqual([a!.label, b!.label].sort());
    for (const x of list) {
      expect(x).toMatchObject({
        status: "SUGGESTED",
        importance: 4,
        conviction: null,
        source: { questionId: q.id, prompt: q.prompt, explanation: "Because." },
        sourceChanged: false,
      });
    }
    const evidence = await prisma.beliefEvidence.findMany();
    expect(evidence.map((e) => e.choiceValue).sort()).toEqual([a!.value, b!.value].sort());
  });

  it("creates no beliefs for skips or 'not sure'", async () => {
    const cookie = await startSession();
    const q = await multiQuestion();
    await answer(cookie, guidedAnswer(q.id, { outcome: "UNSURE" }));
    expect(await beliefs(cookie)).toEqual([]);
    await answer(cookie, guidedAnswer(q.id, { outcome: "SKIPPED" }));
    expect(await beliefs(cookie)).toEqual([]);
  });

  it("follows answer changes for suggestions but never changes a confirmed belief", async () => {
    const cookie = await startSession();
    const q = await multiQuestion();
    const [a, b, c] = q.choices;
    await answer(cookie, guidedAnswer(q.id, { choiceValues: [a!.value, b!.value] }));

    const first = await beliefs(cookie);
    const toConfirm = first.find((x) => x.position === a!.label)!;
    const confirmRes = await patch(cookie, toConfirm.id, {
      version: toConfirm.version,
      position: "My own wording of A",
    });
    expect(confirmRes.status).toBe(200);

    // Change the answer to C only: B's suggestion goes, C's arrives, the confirmed A stays as is.
    await answer(cookie, guidedAnswer(q.id, { choiceValues: [c!.value], importance: 2 }));
    const after = await beliefs(cookie);
    expect(after.map((x) => [x.status, x.position]).sort()).toEqual(
      [
        ["CONFIRMED", "My own wording of A"],
        ["SUGGESTED", c!.label],
      ].sort(),
    );
    const kept = after.find((x) => x.id === toConfirm.id)!;
    expect(kept.sourceChanged).toBe(true);
    expect(kept.importance).toBeNull();

    // Picking A again clears the flag and does not create a duplicate suggestion.
    await answer(cookie, guidedAnswer(q.id, { choiceValues: [a!.value, c!.value] }));
    const again = await beliefs(cookie);
    expect(again).toHaveLength(2);
    expect(again.find((x) => x.id === toConfirm.id)!.sourceChanged).toBe(false);
  });

  it("does not suggest a choice again after the user rejected it", async () => {
    const cookie = await startSession();
    const q = await multiQuestion();
    const [a, b] = q.choices;
    await answer(cookie, guidedAnswer(q.id, { choiceValues: [a!.value] }));
    const [only] = await beliefs(cookie);
    expect((await patch(cookie, only!.id, { version: 1, status: "REJECTED" })).status).toBe(200);

    await answer(cookie, guidedAnswer(q.id, { choiceValues: [a!.value, b!.value] }));
    const list = await beliefs(cookie);
    expect(list.filter((x) => x.position === a!.label).map((x) => x.status)).toEqual(["REJECTED"]);
  });
});

describe("PATCH /api/beliefs/:id", () => {
  async function oneSuggestion() {
    const cookie = await startSession();
    const q = await multiQuestion();
    await answer(cookie, guidedAnswer(q.id, { choiceValues: [q.choices[0]!.value] }));
    const [b] = await beliefs(cookie);
    return { cookie, belief: b! };
  }

  it("confirms, rates and records each change as a revision", async () => {
    const { cookie, belief } = await oneSuggestion();
    const confirmed = await patch(cookie, belief.id, { version: 1, status: "CONFIRMED" });
    expect((await confirmed.json()).belief).toMatchObject({ status: "CONFIRMED", version: 2 });
    const rated = await patch(cookie, belief.id, { version: 2, importance: 5, conviction: 3 });
    expect((await rated.json()).belief).toMatchObject({ importance: 5, conviction: 3, version: 3 });

    const revisions = await prisma.beliefRevision.findMany({ orderBy: { createdAt: "asc" } });
    expect(revisions).toHaveLength(2);
    expect(revisions[0]).toMatchObject({
      actor: "USER",
      previousValue: expect.objectContaining({ status: "SUGGESTED" }),
      newValue: expect.objectContaining({ status: "CONFIRMED" }),
    });
  });

  it("rejects a stale version with 409 instead of overwriting", async () => {
    const { cookie, belief } = await oneSuggestion();
    expect((await patch(cookie, belief.id, { version: 1, status: "CONFIRMED" })).status).toBe(200);
    const stale = await patch(cookie, belief.id, { version: 1, status: "REJECTED" });
    expect(stale.status).toBe(409);
    expect((await prisma.belief.findUniqueOrThrow({ where: { id: belief.id } })).status).toBe(
      "CONFIRMED",
    );
  });

  it("needs a confirmed belief before rating it", async () => {
    const { cookie, belief } = await oneSuggestion();
    const res = await patch(cookie, belief.id, { version: 1, conviction: 4 });
    expect(res.status).toBe(422);
  });

  it("keeps beliefs private to their session and refuses cross-origin changes", async () => {
    const { cookie, belief } = await oneSuggestion();
    const other = await startSession();
    expect((await patch(other, belief.id, { version: 1, status: "REJECTED" })).status).toBe(404);
    expect(await beliefs(other)).toEqual([]);
    const crossOrigin = await patch(
      cookie,
      belief.id,
      { version: 1, status: "REJECTED" },
      "https://evil.example",
    );
    expect(crossOrigin.status).toBe(403);
    expect((await patch(cookie, "not-a-uuid", { version: 1, status: "REJECTED" })).status).toBe(
      404,
    );
    const anonymous = await patchBelief(
      apiRequest(`/api/beliefs/${belief.id}`, { method: "PATCH", body: { version: 1 } }),
      { params: Promise.resolve({ id: belief.id }) },
    );
    expect(anonymous.status).toBe(401);
  });

  it("is deleted with the session", async () => {
    const { cookie } = await oneSuggestion();
    await deleteCurrent(apiRequest("/api/sessions/current", { method: "DELETE", cookie }));
    expect(await prisma.belief.count()).toBe(0);
    expect(await prisma.beliefEvidence.count()).toBe(0);
  });
});

describe("GET /api/profile", () => {
  it("shows the preview after three answered questions, with coverage gaps", async () => {
    const cookie = await startSession();
    const questions = await prisma.question.findMany({
      where: { responseType: "SINGLE_CHOICE", archivedAt: null },
      include: { topic: true },
      orderBy: { slug: "asc" },
    });
    const distinctCategories = [
      ...new Map(questions.map((q) => [q.topic.categoryId, q])).values(),
    ].slice(0, 3);

    const empty = await profile(cookie);
    expect(empty).toMatchObject({ ready: false, answeredQuestions: 0, preliminary: true });

    for (const [i, q] of distinctCategories.entries()) {
      const choice = (q.choices as { value: string }[])[0]!.value;
      await answer(cookie, guidedAnswer(q.id, { choiceValues: [choice] }));
      expect((await profile(cookie)).ready).toBe(i === 2);
    }
    const p = await profile(cookie);
    expect(p.answeredQuestions).toBe(3);
    expect(p.counts).toMatchObject({ suggested: 3, confirmed: 0, rejected: 0 });
    const categoriesTotal = await prisma.issueCategory.count({ where: { active: true } });
    expect(p.gaps).toHaveLength(categoriesTotal - 3);
    expect(p.categories.filter((c) => c.suggested.length > 0)).toHaveLength(3);
  });
});
