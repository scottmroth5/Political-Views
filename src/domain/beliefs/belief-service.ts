import { DomainError } from "@/domain/errors";
import type { QuestionChoice } from "@/domain/questions/question-types";
import {
  createDerivedBelief,
  findSessionBelief,
  listDerivedBeliefs,
  listSessionBeliefs,
  removeSuggestedBeliefs,
  updateBeliefByUser,
  updateSuggestedBelief,
  type BeliefWithSources,
} from "./belief-repository";
import type { Db } from "@/lib/db";
import { applyBeliefPatch, type BeliefPatch, type BeliefValues } from "./belief-schema";
import {
  isSourceChanged,
  planGuidedBeliefs,
  type BeliefStatusValue,
  type GuidedAnswerState,
} from "./guided-derivation";

export interface BeliefDto {
  id: string;
  version: number;
  status: BeliefStatusValue;
  position: string;
  nuance: string | null;
  importance: number | null;
  conviction: number | null;
  topic: string | null;
  /** The answer this belief came from, shown so the user can see why it was suggested. */
  source: { questionId: string; prompt: string; explanation: string | null } | null;
  /** Confirmed, but the answer it came from has since changed: the user should take another look. */
  sourceChanged: boolean;
}

/**
 * Brings the suggested beliefs for one guided response in line with it. Run in the same
 * transaction as the response write, so the profile never disagrees with the answers.
 */
export async function syncGuidedBeliefs(
  db: Db,
  input: {
    sessionId: string;
    topicId: string;
    responseId: string;
    answer: GuidedAnswerState;
    choices: QuestionChoice[];
  },
): Promise<void> {
  const existing = await listDerivedBeliefs(db, input.sessionId, input.responseId);
  const plan = planGuidedBeliefs(input.answer, input.choices, existing);
  await removeSuggestedBeliefs(db, input.sessionId, plan.remove);
  for (const u of plan.update) {
    await updateSuggestedBelief(db, u.id, { position: u.position, importance: u.importance });
  }
  for (const c of plan.create) {
    await createDerivedBelief(db, {
      sessionId: input.sessionId,
      topicId: input.topicId,
      responseId: input.responseId,
      ...c,
    });
  }
}

export function toBeliefDto(b: BeliefWithSources): BeliefDto {
  const evidence = b.evidence[0];
  const response = evidence?.response;
  const question = response?.question;
  return {
    id: b.id,
    version: b.version,
    status: b.status,
    position: b.position,
    nuance: b.nuance,
    importance: b.importance,
    conviction: b.conviction,
    topic: b.topic?.label ?? null,
    source: question
      ? { questionId: question.id, prompt: question.prompt, explanation: response.text }
      : null,
    sourceChanged: evidence
      ? isSourceChanged({ status: b.status, choiceValue: evidence.choiceValue }, response ?? null)
      : false,
  };
}

export async function listBeliefs(sessionId: string): Promise<BeliefDto[]> {
  return (await listSessionBeliefs(sessionId)).map(toBeliefDto);
}

/** A user's confirm, reject, rewording or rating, checked against the version they saw. */
export async function updateBelief(
  sessionId: string,
  id: string,
  patch: BeliefPatch,
): Promise<BeliefDto> {
  const current = await findSessionBelief(sessionId, id);
  if (!current) throw new DomainError("BELIEF_NOT_FOUND", "That belief was not found.", 404);
  if (current.version !== patch.version) throw conflict();

  const previous: BeliefValues = {
    status: current.status,
    position: current.position,
    nuance: current.nuance,
    importance: current.importance,
    conviction: current.conviction,
  };
  const next = applyBeliefPatch(previous, patch);
  if (next) {
    const saved = await updateBeliefByUser(sessionId, id, patch.version, previous, next);
    if (!saved) throw conflict();
  }
  const updated = await findSessionBelief(sessionId, id);
  if (!updated) throw new DomainError("BELIEF_NOT_FOUND", "That belief was not found.", 404);
  return toBeliefDto(updated);
}

function conflict() {
  return new DomainError(
    "BELIEF_CHANGED",
    "This belief changed since you opened it. Reload to see the latest version.",
    409,
  );
}
