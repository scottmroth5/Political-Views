import type { QuestionChoice } from "@/domain/questions/question-types";

/**
 * Turning a guided answer into suggested beliefs, without AI.
 *
 * Each selected choice becomes one suggested belief whose position is the choice's own wording, so
 * nothing is inferred beyond what the user picked. "Not sure", skips and free text yield none.
 *
 * Ownership rule: SUGGESTED beliefs belong to the system and always mirror the current answer
 * (created, reworded, re-rated or removed as the answer changes). CONFIRMED and REJECTED beliefs
 * belong to the user and are never changed here; if the answer behind a confirmed belief changes,
 * the profile flags it for review instead (see isSourceChanged).
 */

export type BeliefStatusValue = "SUGGESTED" | "CONFIRMED" | "REJECTED";

export interface GuidedAnswerState {
  outcome: "ANSWERED" | "SKIPPED" | "UNSURE";
  choiceValues: readonly string[];
  importance: number | null;
}

export interface DerivedBeliefState {
  id: string;
  status: BeliefStatusValue;
  choiceValue: string;
  position: string;
  importance: number | null;
}

export interface DerivationPlan {
  create: { choiceValue: string; position: string; importance: number | null }[];
  update: { id: string; position: string; importance: number | null }[];
  remove: string[];
}

export function planGuidedBeliefs(
  answer: GuidedAnswerState,
  choices: readonly QuestionChoice[],
  existing: readonly DerivedBeliefState[],
): DerivationPlan {
  const labels = new Map(choices.map((c) => [c.value, c.label]));
  const desired =
    answer.outcome === "ANSWERED" ? answer.choiceValues.filter((v) => labels.has(v)) : [];
  const plan: DerivationPlan = { create: [], update: [], remove: [] };

  for (const belief of existing) {
    if (belief.status !== "SUGGESTED") continue;
    const label = labels.get(belief.choiceValue);
    if (label === undefined || !desired.includes(belief.choiceValue)) {
      plan.remove.push(belief.id);
    } else if (belief.position !== label || belief.importance !== answer.importance) {
      plan.update.push({ id: belief.id, position: label, importance: answer.importance });
    }
  }

  // A choice the user already confirmed or rejected is not suggested again.
  const covered = new Set(existing.map((b) => b.choiceValue));
  for (const value of desired) {
    if (!covered.has(value)) {
      plan.create.push({
        choiceValue: value,
        position: labels.get(value)!,
        importance: answer.importance,
      });
    }
  }
  return plan;
}

/** A confirmed belief whose choice is no longer part of the answer it came from. */
export function isSourceChanged(
  belief: { status: BeliefStatusValue; choiceValue: string | null },
  answer: Pick<GuidedAnswerState, "outcome" | "choiceValues"> | null,
): boolean {
  if (belief.status !== "CONFIRMED" || belief.choiceValue === null) return false;
  if (!answer || answer.outcome !== "ANSWERED") return true;
  return !answer.choiceValues.includes(belief.choiceValue);
}
