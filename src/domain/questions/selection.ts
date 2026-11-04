/**
 * Deterministic next-question selection (PRD §5).
 *
 * Milestone 2 implements criteria (a) topic coverage and (e) repetition
 * avoidance. Ambiguity, user priority and depth/tradeoff signals are added in
 * Milestone 4 as further ranking keys; AI is never used to choose questions.
 */
export interface CandidateQuestion {
  id: string;
  categoryId: string;
  categoryOrder: number;
  topicOrder: number;
  questionOrder: number;
}

export interface SelectionState {
  /** Questions with any response (answered, unsure or skipped) — never repeated. */
  respondedQuestionIds: ReadonlySet<string>;
  /** Count of responses per category, including skips, to spread coverage. */
  responsesPerCategory: ReadonlyMap<string, number>;
}

export function rankEligibleQuestions<T extends CandidateQuestion>(
  candidates: readonly T[],
  state: SelectionState,
): T[] {
  const coverage = (q: T) => state.responsesPerCategory.get(q.categoryId) ?? 0;
  return candidates
    .filter((q) => !state.respondedQuestionIds.has(q.id))
    .sort(
      (a, b) =>
        coverage(a) - coverage(b) ||
        a.categoryOrder - b.categoryOrder ||
        a.topicOrder - b.topicOrder ||
        a.questionOrder - b.questionOrder ||
        a.id.localeCompare(b.id),
    );
}

export function selectNextQuestion<T extends CandidateQuestion>(
  candidates: readonly T[],
  state: SelectionState,
): T | null {
  return rankEligibleQuestions(candidates, state)[0] ?? null;
}
