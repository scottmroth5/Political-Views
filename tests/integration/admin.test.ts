import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as signIn, DELETE as signOut } from "@/app/api/admin/session/route";
import { POST as addQuestion } from "@/app/api/admin/questions/route";
import { POST as archive } from "@/app/api/admin/questions/[id]/archive/route";
import { POST as review } from "@/app/api/admin/questions/[id]/review/route";
import { GET as getNextQuestion } from "@/app/api/questions/next/route";
import { POST as createSession } from "@/app/api/sessions/route";
import { POST as postResponse } from "@/app/api/responses/route";
import { hashAdminPassword } from "@/domain/admin/admin-password";
import { LOGIN_FAILURE_LIMIT } from "@/domain/admin/admin-session";
import { listGuidedAnswers } from "@/domain/responses/response-service";
import { prisma } from "@/lib/db";
import { resetEnvCacheForTests } from "@/lib/env";
import { seedTaxonomy } from "../../prisma/seed-taxonomy";
import { apiRequest, guidedAnswer, sessionCookieFrom } from "./helpers";

const PASSWORD = "synthetic-admin-password-for-tests";
const HASH = hashAdminPassword(PASSWORD);
const created: string[] = [];

function enableAdmin(hash: string | undefined = HASH) {
  if (hash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = hash;
  resetEnvCacheForTests();
}

async function adminCookie(): Promise<string> {
  const res = await signIn(
    apiRequest("/api/admin/session", { method: "POST", body: { password: PASSWORD } }),
  );
  expect(res.status).toBe(204);
  return sessionCookieFrom(res);
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function someCategoryAndTopic() {
  const topic = await prisma.topic.findFirstOrThrow({
    where: { questions: { some: {} } },
    include: { category: true },
    orderBy: { slug: "asc" },
  });
  return { categoryId: topic.categoryId, topicId: topic.id };
}

async function add(cookie: string, body: Record<string, unknown>) {
  const res = await addQuestion(
    apiRequest("/api/admin/questions", { method: "POST", cookie, body }),
  );
  if (res.status === 201) created.push((await res.clone().json()).id);
  return res;
}

async function draftBody(over: Record<string, unknown> = {}) {
  const { categoryId, topicId } = await someCategoryAndTopic();
  return {
    categoryId,
    topic: { id: topicId },
    prompt: "Synthetic test question: how should this be handled?",
    explanationPrompt: null,
    responseType: "MULTI_CHOICE",
    choices: [
      { label: "Synthetic choice one" },
      { label: "Synthetic choice two" },
      { label: "Keep things as they are", exclusive: true },
    ],
    ...over,
  };
}

beforeAll(() => enableAdmin());
beforeEach(async () => {
  await prisma.adminLoginFailure.deleteMany();
  await prisma.adminSession.deleteMany();
});
afterEach(() => enableAdmin());
afterAll(async () => {
  // Questions are never deleted, so archive everything these tests added.
  await prisma.question.updateMany({
    where: { id: { in: created }, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  await prisma.adminLoginFailure.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.discoverySession.deleteMany();
  enableAdmin(undefined);
  await prisma.$disconnect();
});

describe("admin sign-in", () => {
  it("is turned off (404) when no password hash is configured", async () => {
    enableAdmin(undefined);
    const res = await signIn(
      apiRequest("/api/admin/session", { method: "POST", body: { password: PASSWORD } }),
    );
    expect(res.status).toBe(404);
    const write = await addQuestion(
      apiRequest("/api/admin/questions", { method: "POST", body: await draftBody() }),
    );
    expect(write.status).toBe(404);
  });

  it("sets a strict, HttpOnly cookie and stores only the token hash", async () => {
    const res = await signIn(
      apiRequest("/api/admin/session", { method: "POST", body: { password: PASSWORD } }),
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=strict/i);
    const token = sessionCookieFrom(res).split("=")[1]!;
    const sessions = await prisma.adminSession.findMany();
    expect(sessions).toHaveLength(1);
    expect(JSON.stringify(sessions)).not.toContain(token);
  });

  it("rejects a wrong password, records the failure, and throttles repeated failures", async () => {
    const wrong = await signIn(
      apiRequest("/api/admin/session", { method: "POST", body: { password: "nope" } }),
    );
    expect(wrong.status).toBe(401);
    expect(await prisma.adminLoginFailure.count()).toBe(1);

    await prisma.adminLoginFailure.createMany({
      data: Array.from({ length: LOGIN_FAILURE_LIMIT }, () => ({})),
    });
    const throttled = await signIn(
      apiRequest("/api/admin/session", { method: "POST", body: { password: PASSWORD } }),
    );
    expect(throttled.status).toBe(429);
  });

  it("refuses cross-origin sign-in and admin writes without a session", async () => {
    const cross = await signIn(
      apiRequest("/api/admin/session", {
        method: "POST",
        body: { password: PASSWORD },
        origin: "https://evil.example",
      }),
    );
    expect(cross.status).toBe(403);
    const anonymous = await addQuestion(
      apiRequest("/api/admin/questions", { method: "POST", body: await draftBody() }),
    );
    expect(anonymous.status).toBe(401);
  });

  it("signs out by deleting the session", async () => {
    const cookie = await adminCookie();
    const res = await signOut(apiRequest("/api/admin/session", { method: "DELETE", cookie }));
    expect(res.status).toBe(204);
    expect(await prisma.adminSession.count()).toBe(0);
    expect((await add(cookie, await draftBody())).status).toBe(401);
  });

  it("does not accept an expired session", async () => {
    const cookie = await adminCookie();
    await prisma.adminSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await add(cookie, await draftBody())).status).toBe(401);
  });
});

describe("adding questions", () => {
  it("adds a draft with generated choice values and a recorded time", async () => {
    const cookie = await adminCookie();
    const before = Date.now();
    const res = await add(cookie, await draftBody());
    expect(res.status).toBe(201);
    const q = await prisma.question.findUniqueOrThrow({ where: { id: (await res.json()).id } });
    expect(q).toMatchObject({
      editorialStatus: "DRAFT",
      reviewedAt: null,
      archivedAt: null,
      responseType: "MULTI_CHOICE",
      copiedFromId: null,
    });
    expect(q.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(q.choices).toEqual([
      { value: "synthetic-choice-one", label: "Synthetic choice one" },
      { value: "synthetic-choice-two", label: "Synthetic choice two" },
      { value: "keep-things-as-they-are", label: "Keep things as they are", exclusive: true },
    ]);
  });

  it("can create a new topic in the chosen issue area", async () => {
    const cookie = await adminCookie();
    const { categoryId } = await someCategoryAndTopic();
    const label = `Synthetic topic ${Date.now()}`;
    const res = await add(cookie, await draftBody({ topic: { newLabel: label } }));
    expect(res.status).toBe(201);
    const q = await prisma.question.findUniqueOrThrow({
      where: { id: (await res.json()).id },
      include: { topic: true },
    });
    expect(q.topic).toMatchObject({ label, categoryId });
  });

  it("validates the question", async () => {
    const cookie = await adminCookie();
    const duplicate = await add(
      cookie,
      await draftBody({ choices: [{ label: "Same" }, { label: "same" }] }),
    );
    expect(duplicate.status).toBe(422);
    const exclusiveOnSingle = await add(
      cookie,
      await draftBody({
        responseType: "SINGLE_CHOICE",
        choices: [{ label: "A" }, { label: "B", exclusive: true }],
      }),
    );
    expect(exclusiveOnSingle.status).toBe(422);
    const tooFew = await add(cookie, await draftBody({ choices: [{ label: "Only one" }] }));
    expect(tooFew.status).toBe(422);
  });

  it("copies a question into a new one and can archive the original in the same step", async () => {
    const cookie = await adminCookie();
    const original = (await (await add(cookie, await draftBody())).json()).id as string;
    const copy = await add(
      cookie,
      await draftBody({
        prompt: "Synthetic test question, reworded: how should this be handled?",
        copiedFromId: original,
        archiveOriginal: true,
      }),
    );
    expect(copy.status).toBe(201);
    const copied = await prisma.question.findUniqueOrThrow({
      where: { id: (await copy.json()).id },
    });
    expect(copied.copiedFromId).toBe(original);
    const source = await prisma.question.findUniqueOrThrow({ where: { id: original } });
    expect(source.archivedAt).not.toBeNull();
    expect(source.prompt).toBe("Synthetic test question: how should this be handled?");
  });
});

describe("archiving and reviewing", () => {
  it("archived questions are no longer asked or answerable; earlier answers are kept", async () => {
    const cookie = await adminCookie();
    const id = (await (await add(cookie, await draftBody())).json()).id as string;
    const participant = sessionCookieFrom(
      await createSession(
        apiRequest("/api/sessions", { method: "POST", body: { mode: "GUIDED" } }),
      ),
    );
    const answered = await postResponse(
      apiRequest("/api/responses", {
        method: "POST",
        cookie: participant,
        body: guidedAnswer(id, { choiceValues: ["synthetic-choice-one"] }),
      }),
    );
    expect(answered.status).toBe(201);

    expect(
      (
        await archive(
          apiRequest(`/api/admin/questions/${id}/archive`, { method: "POST", cookie }),
          params(id),
        )
      ).status,
    ).toBe(204);
    const archivedAt = (await prisma.question.findUniqueOrThrow({ where: { id } })).archivedAt;
    expect(archivedAt).not.toBeNull();
    // Archiving again is harmless and keeps the first time.
    await archive(
      apiRequest(`/api/admin/questions/${id}/archive`, { method: "POST", cookie }),
      params(id),
    );
    expect((await prisma.question.findUniqueOrThrow({ where: { id } })).archivedAt).toEqual(
      archivedAt,
    );

    const again = await postResponse(
      apiRequest("/api/responses", {
        method: "POST",
        cookie: participant,
        body: guidedAnswer(id, { choiceValues: ["synthetic-choice-two"] }),
      }),
    );
    expect(again.status).toBe(404);

    const session = await prisma.discoverySession.findFirstOrThrow({
      where: { responses: { some: { questionId: id } } },
    });
    const history = await listGuidedAnswers(session.id);
    expect(history.find((a) => a.questionId === id)).toMatchObject({ changeable: false });

    const next = await (
      await getNextQuestion(apiRequest("/api/questions/next", { cookie: participant }))
    ).json();
    expect(next.question?.id).not.toBe(id);
    expect(next.progress.respondedQuestions).toBe(0);
  });

  it("marks a draft reviewed with a time, and never an archived one", async () => {
    const cookie = await adminCookie();
    const id = (await (await add(cookie, await draftBody())).json()).id as string;
    const res = await review(
      apiRequest(`/api/admin/questions/${id}/review`, { method: "POST", cookie }),
      params(id),
    );
    expect(res.status).toBe(204);
    const q = await prisma.question.findUniqueOrThrow({ where: { id } });
    expect(q.editorialStatus).toBe("REVIEWED");
    expect(q.reviewedAt).not.toBeNull();

    const other = (await (await add(cookie, await draftBody())).json()).id as string;
    await archive(
      apiRequest(`/api/admin/questions/${other}/archive`, { method: "POST", cookie }),
      params(other),
    );
    const refused = await review(
      apiRequest(`/api/admin/questions/${other}/review`, { method: "POST", cookie }),
      params(other),
    );
    expect(refused.status).toBe(409);
  });
});

describe("database guarantees", () => {
  it("refuses to edit, delete, un-archive or un-review a question", async () => {
    const cookie = await adminCookie();
    const id = (await (await add(cookie, await draftBody())).json()).id as string;

    await expect(
      prisma.question.update({ where: { id }, data: { prompt: "Changed" } }),
    ).rejects.toThrow();
    await expect(
      prisma.question.update({ where: { id }, data: { choices: [] } }),
    ).rejects.toThrow();
    await expect(prisma.question.delete({ where: { id } })).rejects.toThrow();

    await review(
      apiRequest(`/api/admin/questions/${id}/review`, { method: "POST", cookie }),
      params(id),
    );
    await expect(
      prisma.question.update({
        where: { id },
        data: { editorialStatus: "DRAFT", reviewedAt: null },
      }),
    ).rejects.toThrow();

    await archive(
      apiRequest(`/api/admin/questions/${id}/archive`, { method: "POST", cookie }),
      params(id),
    );
    await expect(
      prisma.question.update({ where: { id }, data: { archivedAt: null } }),
    ).rejects.toThrow();
  });

  it("reseeding leaves existing questions exactly as they are", async () => {
    const before = await prisma.question.findMany({ orderBy: { id: "asc" } });
    const result = await seedTaxonomy(prisma);
    expect(result.questionsAdded).toBe(0);
    expect(await prisma.question.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  });
});
