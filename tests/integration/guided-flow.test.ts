import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as createSession } from "@/app/api/sessions/route";
import {
  DELETE as deleteCurrent,
  GET as getCurrent,
  PATCH as patchCurrent,
} from "@/app/api/sessions/current/route";
import { POST as postResponse } from "@/app/api/responses/route";
import { GET as getNextQuestion } from "@/app/api/questions/next/route";
import { GET as getQuestionById } from "@/app/api/questions/[id]/route";
import { prisma } from "@/lib/db";
import { hashSessionToken } from "@/domain/sessions/session-token";
import type { QuestionDto } from "@/domain/questions/question-types";
import { seedTaxonomy } from "../../prisma/seed-taxonomy";
import { apiRequest, guidedAnswer, sessionCookieFrom } from "./helpers";

async function startSession(mode: "GUIDED" | "CONVERSATION" = "GUIDED") {
  const res = await createSession(apiRequest("/api/sessions", { method: "POST", body: { mode } }));
  expect(res.status).toBe(201);
  return sessionCookieFrom(res);
}

async function nextQuestion(cookie: string) {
  const res = await getNextQuestion(apiRequest("/api/questions/next", { cookie }));
  expect(res.status).toBe(200);
  return (await res.json()) as { question: QuestionDto | null; progress: Record<string, number> };
}

async function answer(cookie: string, body: Record<string, unknown>) {
  return postResponse(apiRequest("/api/responses", { method: "POST", cookie, body }));
}

beforeEach(async () => {
  await prisma.discoverySession.deleteMany();
});

afterAll(async () => {
  await prisma.discoverySession.deleteMany();
  await prisma.$disconnect();
});

describe("seeding", () => {
  it("is idempotent: reseeding unchanged content does not bump versions", async () => {
    const before = await prisma.question.findMany({ select: { slug: true, version: true } });
    await seedTaxonomy(prisma);
    const after = await prisma.question.findMany({ select: { slug: true, version: true } });
    expect(after).toEqual(expect.arrayContaining(before));
    expect(after).toHaveLength(before.length);
  });
});

describe("anonymous session", () => {
  it("issues an HttpOnly, SameSite cookie and stores only the token hash", async () => {
    const res = await createSession(
      apiRequest("/api/sessions", { method: "POST", body: { mode: "GUIDED" } }),
    );
    expect(res.status).toBe(201);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);

    const token = sessionCookieFrom(res).split("=")[1]!;
    const rows = await prisma.discoverySession.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashSessionToken(token));
    expect(JSON.stringify(rows[0])).not.toContain(token);
  });

  it("reuses an existing active session instead of creating another", async () => {
    const cookie = await startSession("GUIDED");
    const res = await createSession(
      apiRequest("/api/sessions", { method: "POST", cookie, body: { mode: "CONVERSATION" } }),
    );
    expect(res.status).toBe(200);
    expect(await prisma.discoverySession.count()).toBe(1);
    expect((await prisma.discoverySession.findFirstOrThrow()).mode).toBe("CONVERSATION");
  });

  it("rejects cross-origin state-changing requests", async () => {
    const res = await createSession(
      apiRequest("/api/sessions", {
        method: "POST",
        body: { mode: "GUIDED" },
        origin: "https://evil.example",
      }),
    );
    expect(res.status).toBe(403);
    expect(await prisma.discoverySession.count()).toBe(0);
  });

  it("requires a session for session-scoped routes", async () => {
    const res = await getNextQuestion(apiRequest("/api/questions/next"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("NO_SESSION");
  });
});

describe("guided discovery", () => {
  it("persists an answer, moves to a new issue area, and resumes with the same cookie", async () => {
    const cookie = await startSession();
    const first = await nextQuestion(cookie);
    expect(first.question).not.toBeNull();
    expect(first.progress.totalQuestions).toBeGreaterThanOrEqual(24);

    const choice = first.question!.choices[0]!.value;
    const res = await answer(
      cookie,
      guidedAnswer(first.question!.id, {
        choiceValues: [choice],
        importance: 4,
        text: "Synthetic test rationale",
      }),
    );
    expect(res.status).toBe(201);

    const second = await nextQuestion(cookie);
    expect(second.question!.id).not.toBe(first.question!.id);
    expect(second.question!.category.slug).not.toBe(first.question!.category.slug);
    expect(second.progress.respondedQuestions).toBe(1);

    // "Return later": a fresh request with only the cookie sees the saved progress.
    const current = await getCurrent(apiRequest("/api/sessions/current", { cookie }));
    expect(current.status).toBe(200);
    expect((await current.json()).progress.answeredQuestions).toBe(1);

    const stored = await prisma.response.findFirstOrThrow();
    expect(stored).toMatchObject({
      choiceValues: [choice],
      importance: 4,
      mode: "GUIDED",
      questionVersion: first.question!.version,
    });
  });

  it("is idempotent: retrying the same request does not write twice", async () => {
    const cookie = await startSession();
    const { question } = await nextQuestion(cookie);
    const body = guidedAnswer(question!.id, { choiceValues: [question!.choices[0]!.value] });

    expect((await answer(cookie, body)).status).toBe(201);
    const retry = await answer(cookie, body);
    expect(retry.status).toBe(200);
    expect((await retry.json()).status).toBe("replayed");
    expect(await prisma.response.count()).toBe(1);
  });

  it("re-answering a question updates the same response row", async () => {
    const cookie = await startSession();
    const { question } = await nextQuestion(cookie);
    await answer(
      cookie,
      guidedAnswer(question!.id, { choiceValues: [question!.choices[0]!.value] }),
    );
    const edit = await answer(
      cookie,
      guidedAnswer(question!.id, { choiceValues: [question!.choices[1]!.value] }),
    );
    expect((await edit.json()).status).toBe("updated");
    const rows = await prisma.response.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.choiceValues).toEqual([question!.choices[1]!.value]);
  });

  it("returns a question with this session's earlier answer for editing", async () => {
    const cookie = await startSession();
    const { question } = await nextQuestion(cookie);
    const id = question!.id;
    const fetchForEdit = (c: string, qid: string) =>
      getQuestionById(apiRequest(`/api/questions/${qid}`, { cookie: c }), {
        params: Promise.resolve({ id: qid }),
      });

    const before = await fetchForEdit(cookie, id);
    expect(before.status).toBe(200);
    expect((await before.json()).answer).toBeNull();

    await answer(
      cookie,
      guidedAnswer(id, {
        choiceValues: [question!.choices[0]!.value],
        text: "Synthetic reason",
        importance: 4,
      }),
    );
    const after = await fetchForEdit(cookie, id);
    const body = await after.json();
    expect(body.question.id).toBe(id);
    expect(body.answer).toEqual({
      outcome: "ANSWERED",
      choiceValues: [question!.choices[0]!.value],
      text: "Synthetic reason",
      importance: 4,
    });

    // Another session sees the question but not this session's answer.
    const other = await startSession();
    expect((await (await fetchForEdit(other, id)).json()).answer).toBeNull();

    // Unknown or malformed ids, and no session, are rejected.
    expect((await fetchForEdit(cookie, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await fetchForEdit(cookie, "not-a-uuid")).status).toBe(404);
    const anonymous = await getQuestionById(apiRequest(`/api/questions/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(anonymous.status).toBe(401);
  });

  it("rejects a choice that does not belong to the question", async () => {
    const cookie = await startSession();
    const { question } = await nextQuestion(cookie);
    const res = await answer(
      cookie,
      guidedAnswer(question!.id, { choiceValues: ["not-a-real-choice"] }),
    );
    expect(res.status).toBe(422);
    expect(await prisma.response.count()).toBe(0);
  });

  it("records skip and not-sure, keeping no content for skips", async () => {
    const cookie = await startSession();
    const q1 = (await nextQuestion(cookie)).question!;
    await answer(
      cookie,
      guidedAnswer(q1.id, { outcome: "SKIPPED", text: "should be dropped", importance: 3 }),
    );
    const q2 = (await nextQuestion(cookie)).question!;
    await answer(cookie, guidedAnswer(q2.id, { outcome: "UNSURE", text: "I see both sides" }));

    const skipped = await prisma.response.findFirstOrThrow({ where: { questionId: q1.id } });
    expect(skipped).toMatchObject({
      outcome: "SKIPPED",
      text: null,
      importance: null,
      choiceValues: [],
    });
    const unsure = await prisma.response.findFirstOrThrow({ where: { questionId: q2.id } });
    expect(unsure).toMatchObject({ outcome: "UNSURE", text: "I see both sides" });

    const { progress } = await nextQuestion(cookie);
    expect(progress).toMatchObject({ respondedQuestions: 2, answeredQuestions: 1 });
  });

  it("keeps sessions isolated from each other", async () => {
    const a = await startSession();
    const b = await startSession();
    const { question } = await nextQuestion(a);
    await answer(a, guidedAnswer(question!.id, { choiceValues: [question!.choices[0]!.value] }));

    const forB = await nextQuestion(b);
    expect(forB.progress.respondedQuestions).toBe(0);
    expect(forB.question!.id).toBe(question!.id);
  });
});

describe("mode switching, expiry and deletion", () => {
  it("switches mode without losing answers", async () => {
    const cookie = await startSession("GUIDED");
    const { question } = await nextQuestion(cookie);
    await answer(
      cookie,
      guidedAnswer(question!.id, { choiceValues: [question!.choices[0]!.value] }),
    );

    const toChat = await patchCurrent(
      apiRequest("/api/sessions/current", {
        method: "PATCH",
        cookie,
        body: { mode: "CONVERSATION" },
      }),
    );
    expect((await toChat.json()).session.mode).toBe("CONVERSATION");
    await patchCurrent(
      apiRequest("/api/sessions/current", { method: "PATCH", cookie, body: { mode: "GUIDED" } }),
    );

    const after = await nextQuestion(cookie);
    expect(after.progress.respondedQuestions).toBe(1);
    expect(after.question!.id).not.toBe(question!.id);
  });

  it("treats an expired session as gone and deletes its data", async () => {
    const cookie = await startSession();
    const { question } = await nextQuestion(cookie);
    await answer(
      cookie,
      guidedAnswer(question!.id, { choiceValues: [question!.choices[0]!.value] }),
    );
    await prisma.discoverySession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await getNextQuestion(apiRequest("/api/questions/next", { cookie }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("SESSION_EXPIRED");
    expect(await prisma.discoverySession.count()).toBe(0);
    expect(await prisma.response.count()).toBe(0);
  });

  it("deletes the session and all associated responses, and clears the cookie", async () => {
    const cookie = await startSession();
    const { question } = await nextQuestion(cookie);
    await answer(
      cookie,
      guidedAnswer(question!.id, { choiceValues: [question!.choices[0]!.value] }),
    );

    const res = await deleteCurrent(
      apiRequest("/api/sessions/current", { method: "DELETE", cookie }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
    expect(await prisma.discoverySession.count()).toBe(0);
    expect(await prisma.response.count()).toBe(0);

    const after = await getNextQuestion(apiRequest("/api/questions/next", { cookie }));
    expect(after.status).toBe(401);
  });
});

describe("multi-select questions", () => {
  async function findMultiQuestion(withExclusive: boolean) {
    const questions = await prisma.question.findMany({ where: { responseType: "MULTI_CHOICE" } });
    const match = questions.find((q) => {
      const list = q.choices as { value: string; exclusive?: boolean }[];
      return list.some((c) => c.exclusive) === withExclusive;
    });
    if (!match) throw new Error("Seed data should include this kind of multi-select question");
    return { id: match.id, choices: match.choices as { value: string; exclusive?: boolean }[] };
  }

  it("stores a combination of choices in display order", async () => {
    const cookie = await startSession();
    const q = await findMultiQuestion(false);
    const picked = [q.choices[2]!.value, q.choices[0]!.value];
    const res = await answer(cookie, guidedAnswer(q.id, { choiceValues: picked }));
    expect(res.status).toBe(201);
    const stored = await prisma.response.findFirstOrThrow({ where: { questionId: q.id } });
    expect(stored.choiceValues).toEqual([q.choices[0]!.value, q.choices[2]!.value]);
  });

  it("rejects combining an exclusive choice with others", async () => {
    const cookie = await startSession();
    const q = await findMultiQuestion(true);
    const exclusive = q.choices.find((c) => c.exclusive)!.value;
    const other = q.choices.find((c) => !c.exclusive)!.value;
    const res = await answer(cookie, guidedAnswer(q.id, { choiceValues: [other, exclusive] }));
    expect(res.status).toBe(422);
    expect(await prisma.response.count()).toBe(0);
  });

  it("rejects multiple choices on a single-choice question", async () => {
    const cookie = await startSession();
    const q = await prisma.question.findFirstOrThrow({ where: { responseType: "SINGLE_CHOICE" } });
    const list = q.choices as { value: string }[];
    const res = await answer(
      cookie,
      guidedAnswer(q.id, { choiceValues: [list[0]!.value, list[1]!.value] }),
    );
    expect(res.status).toBe(422);
  });
});
