import { describe, expect, it } from "vitest";
import {
  rankEligibleQuestions,
  selectNextQuestion,
  type CandidateQuestion,
} from "@/domain/questions/selection";

const q = (
  id: string,
  categoryId: string,
  categoryOrder: number,
  topicOrder = 0,
): CandidateQuestion => ({
  id,
  categoryId,
  categoryOrder,
  topicOrder,
  questionOrder: 0,
});

const pool = [
  q("h1", "health", 0, 0),
  q("h2", "health", 0, 1),
  q("e1", "econ", 1, 0),
  q("e2", "econ", 1, 1),
];

const state = (responded: string[], perCategory: Record<string, number> = {}) => ({
  respondedQuestionIds: new Set(responded),
  responsesPerCategory: new Map(Object.entries(perCategory)),
});

describe("selectNextQuestion", () => {
  it("starts with the first question of the first category", () => {
    expect(selectNextQuestion(pool, state([]))?.id).toBe("h1");
  });

  it("spreads coverage across categories before going deeper", () => {
    expect(selectNextQuestion(pool, state(["h1"], { health: 1 }))?.id).toBe("e1");
  });

  it("treats a skipped question as covered so the category is not immediately repeated", () => {
    // Skips are counted in responsesPerCategory by the service.
    expect(selectNextQuestion(pool, state(["h1"], { health: 1 }))?.categoryId).toBe("econ");
  });

  it("never repeats a responded question", () => {
    const ranked = rankEligibleQuestions(pool, state(["h1", "e1"], { health: 1, econ: 1 }));
    expect(ranked.map((r) => r.id)).toEqual(["h2", "e2"]);
  });

  it("returns null when every question has a response", () => {
    expect(selectNextQuestion(pool, state(["h1", "h2", "e1", "e2"]))).toBeNull();
  });

  it("is deterministic regardless of input order", () => {
    const shuffled = [pool[3]!, pool[0]!, pool[2]!, pool[1]!];
    expect(rankEligibleQuestions(shuffled, state([])).map((r) => r.id)).toEqual(
      rankEligibleQuestions(pool, state([])).map((r) => r.id),
    );
  });
});
