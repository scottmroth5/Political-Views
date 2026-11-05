import type { Response } from "@prisma/client";
import { syncGuidedBeliefs } from "@/domain/beliefs/belief-service";
import { DomainError } from "@/domain/errors";
import { findServableQuestion } from "@/domain/questions/question-repository";
import { parseChoices } from "@/domain/questions/question-types";
import { prisma, type Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { normalizeGuidedAnswer } from "./answer-validation";
import {
  createGuidedResponse,
  findGuidedResponse,
  findResponseByIdempotencyKey,
  isUniqueConstraintError,
  listGuidedResponsesWithQuestions,
  updateGuidedResponse,
  type GuidedAnswerWrite,
} from "./response-repository";
import type { GuidedResponseInput } from "./response-schema";

export interface GuidedResponseDto {
  id: string;
  questionId: string;
  outcome: Response["outcome"];
  choiceValues: string[];
  text: string | null;
  importance: number | null;
  updatedAt: string;
}

export type RecordResult = {
  response: GuidedResponseDto;
  status: "created" | "updated" | "replayed";
};

function toDto(r: Response): GuidedResponseDto {
  return {
    id: r.id,
    questionId: r.questionId ?? "",
    outcome: r.outcome,
    choiceValues: r.choiceValues,
    text: r.text,
    importance: r.importance,
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function replay(sessionId: string, input: GuidedResponseInput): Promise<RecordResult | null> {
  const prior = await findResponseByIdempotencyKey(sessionId, input.idempotencyKey);
  if (!prior) return null;
  if (prior.questionId !== input.questionId) {
    throw new DomainError("IDEMPOTENCY_KEY_REUSED", "This request key was already used.", 409);
  }
  return { response: toDto(prior), status: "replayed" };
}

/**
 * Persists (or edits) the session's answer to a guided question. Retries with
 * the same idempotency key return the original result without writing again.
 */
export async function recordGuidedResponse(
  sessionId: string,
  input: GuidedResponseInput,
): Promise<RecordResult> {
  const replayed = await replay(sessionId, input);
  if (replayed) return replayed;

  const question = await findServableQuestion(
    input.questionId,
    getEnv().REQUIRE_REVIEWED_QUESTIONS,
  );
  if (!question)
    throw new DomainError("QUESTION_NOT_FOUND", "That question is not available.", 404);

  const choices = parseChoices(question.choices);
  const answer = normalizeGuidedAnswer({ responseType: question.responseType, choices }, input);
  const write: GuidedAnswerWrite = {
    sessionId,
    questionId: question.id,
    questionVersion: question.version,
    idempotencyKey: input.idempotencyKey,
    ...answer,
  };

  // The answer and the suggested beliefs derived from it are saved together.
  const save = (op: (db: Db) => Promise<Response>) =>
    prisma.$transaction(async (tx) => {
      const saved = await op(tx);
      await syncGuidedBeliefs(tx, {
        sessionId,
        topicId: question.topicId,
        responseId: saved.id,
        answer: saved,
        choices,
      });
      return toDto(saved);
    });

  const existing = await findGuidedResponse(sessionId, question.id);
  if (existing)
    return {
      response: await save((db) => updateGuidedResponse(existing.id, write, db)),
      status: "updated",
    };

  try {
    return { response: await save((db) => createGuidedResponse(write, db)), status: "created" };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    // Lost a race: either a duplicate retry or a concurrent answer to the same question.
    const raced = await replay(sessionId, input);
    if (raced) return raced;
    const current = await findGuidedResponse(sessionId, question.id);
    if (!current) throw error;
    return {
      response: await save((db) => updateGuidedResponse(current.id, write, db)),
      status: "updated",
    };
  }
}

export interface GuidedAnswerSummary {
  responseId: string;
  questionId: string;
  prompt: string;
  categoryLabel: string;
  outcome: Response["outcome"];
  choiceLabels: string[];
  text: string | null;
  importance: number | null;
}

export async function listGuidedAnswers(sessionId: string): Promise<GuidedAnswerSummary[]> {
  const rows = await listGuidedResponsesWithQuestions(sessionId);
  return rows.flatMap((r) => {
    if (!r.question) return [];
    return [
      {
        responseId: r.id,
        questionId: r.question.id,
        prompt: r.question.prompt,
        categoryLabel: r.question.topic.category.label,
        outcome: r.outcome,
        choiceLabels: parseChoices(r.question.choices)
          .filter((c) => r.choiceValues.includes(c.value))
          .map((c) => c.label),
        text: r.text,
        importance: r.importance,
      },
    ];
  });
}
