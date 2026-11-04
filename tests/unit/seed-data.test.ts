import { describe, expect, it } from "vitest";
import { questionChoicesSchema } from "@/domain/questions/question-types";
import { seedCategories } from "../../prisma/seed-data";

describe("seed taxonomy", () => {
  it("has the 12 PRD categories", () => {
    expect(seedCategories.map((c) => c.slug)).toEqual([
      "healthcare",
      "economy-taxation",
      "education",
      "civil-rights-liberties",
      "immigration",
      "government-democracy",
      "corporate-power",
      "environment-energy",
      "public-safety-justice",
      "foreign-policy-defense",
      "housing-affordability",
      "social-support-programs",
    ]);
  });

  it("has at least two foundational questions per category", () => {
    for (const c of seedCategories) expect(c.questions.length, c.slug).toBeGreaterThanOrEqual(2);
  });

  it("uses unique slugs for questions and topics", () => {
    const questions = seedCategories.flatMap((c) => c.questions);
    expect(new Set(questions.map((q) => q.slug)).size).toBe(questions.length);
    expect(new Set(questions.map((q) => q.topic.slug)).size).toBe(questions.length);
  });

  it("offers at least three valid, distinct choices per question", () => {
    for (const q of seedCategories.flatMap((c) => c.questions)) {
      expect(q.choices.length, q.slug).toBeGreaterThanOrEqual(3);
      expect(questionChoicesSchema.safeParse(q.choices).success, q.slug).toBe(true);
      expect(new Set(q.choices.map((ch) => ch.value)).size, q.slug).toBe(q.choices.length);
    }
  });

  it("does not hard-code 'not sure' or 'skip' as choices (the UI always provides them)", () => {
    for (const q of seedCategories.flatMap((c) => c.questions)) {
      for (const ch of q.choices)
        expect(ch.label.toLowerCase(), q.slug).not.toMatch(/not sure|skip|unsure/);
    }
  });

  it("does not mention political parties in prompts or choices", () => {
    const text = JSON.stringify(seedCategories).toLowerCase();
    expect(text).not.toMatch(
      /\b(democrat|republican|liberal|conservative|progressive party|gop)\b/,
    );
  });
});

describe("seed taxonomy: multi-select", () => {
  const questions = seedCategories.flatMap((c) => c.questions);

  it("marks exclusive choices only on multi-select questions, at most one per question", () => {
    for (const q of questions) {
      const exclusive = q.choices.filter((ch) => ch.exclusive);
      if (!q.multiple) expect(exclusive, q.slug).toHaveLength(0);
      expect(exclusive.length, q.slug).toBeLessThanOrEqual(1);
    }
  });

  it("includes both single-choice and multi-select questions", () => {
    expect(questions.some((q) => q.multiple)).toBe(true);
    expect(questions.some((q) => !q.multiple)).toBe(true);
  });
});
