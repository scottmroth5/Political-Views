import { describe, expect, it } from "vitest";
import {
  committedReviews,
  contentHash,
  editorialStatus,
  questionContent,
  reviewState,
  type EditorialReview,
} from "../../prisma/editorial";
import { seedCategories, type SeedQuestion } from "../../prisma/seed-data";

const question: SeedQuestion = {
  slug: "q",
  topic: { slug: "t", label: "T" },
  prompt: "Prompt?",
  explanationPrompt: "Why?",
  multiple: true,
  choices: [
    { value: "a", label: "A" },
    { value: "b", label: "B", exclusive: true },
  ],
};
const hash = contentHash(questionContent(question));
const review = (over: Partial<EditorialReview> = {}): EditorialReview => ({
  slug: "q",
  contentHash: hash,
  reviewedOn: "2026-11-05",
  ...over,
});

describe("contentHash", () => {
  it("is stable and does not depend on object key order", () => {
    const c = questionContent(question);
    const reordered = {
      choices: c.choices.map((ch) => ({
        ...("exclusive" in ch ? { exclusive: ch.exclusive } : {}),
        label: ch.label,
        value: ch.value,
      })),
      responseType: c.responseType,
      explanationPrompt: c.explanationPrompt,
      prompt: c.prompt,
    };
    expect(contentHash(reordered)).toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes with anything the user sees", () => {
    const variants: SeedQuestion[] = [
      { ...question, prompt: "Prompt!" },
      { ...question, explanationPrompt: undefined },
      { ...question, multiple: undefined },
      { ...question, choices: [question.choices[1]!, question.choices[0]!] },
      { ...question, choices: [{ value: "a", label: "A." }, question.choices[1]!] },
      { ...question, choices: [question.choices[0]!, { value: "b", label: "B" }] },
      { ...question, choices: [{ value: "a2", label: "A" }, question.choices[1]!] },
    ];
    for (const v of variants) expect(contentHash(questionContent(v))).not.toBe(hash);
    // The topic and slug are not wording, so they do not reset a review.
    expect(contentHash(questionContent({ ...question, topic: { slug: "x", label: "X" } }))).toBe(
      hash,
    );
  });
});

describe("review state", () => {
  it("is reviewed only when a review matches the current wording", () => {
    expect(reviewState(question, [])).toEqual({ state: "not-reviewed", review: null });
    expect(reviewState(question, [review()]).state).toBe("reviewed");
    expect(reviewState(question, [review({ contentHash: "0000000000000000" })]).state).toBe(
      "changed-since-review",
    );
    expect(editorialStatus(question, [review()])).toBe("REVIEWED");
    expect(editorialStatus(question, [review({ contentHash: "0000000000000000" })])).toBe("DRAFT");
    expect(editorialStatus(question, [review({ slug: "other" })])).toBe("DRAFT");
  });
});

describe("committed reviews file", () => {
  const slugs = new Set(seedCategories.flatMap((c) => c.questions.map((q) => q.slug)));

  it("is well formed: known slugs, one entry each, valid hashes and dates", () => {
    const seen = new Set<string>();
    for (const r of committedReviews) {
      expect(slugs.has(r.slug), `unknown slug ${r.slug}`).toBe(true);
      expect(seen.has(r.slug), `duplicate review for ${r.slug}`).toBe(false);
      seen.add(r.slug);
      expect(r.contentHash).toMatch(/^[0-9a-f]{16}$/);
      expect(r.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect((r.note ?? "").length).toBeLessThanOrEqual(200);
    }
  });
});
