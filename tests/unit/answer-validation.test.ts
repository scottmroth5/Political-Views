import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { normalizeGuidedAnswer } from "@/domain/responses/answer-validation";
import { guidedResponseInputSchema } from "@/domain/responses/response-schema";

const choices = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
  { value: "keep", label: "Keep the current approach", exclusive: true },
];
const singleQuestion = { responseType: "SINGLE_CHOICE" as const, choices };
const multiQuestion = { responseType: "MULTI_CHOICE" as const, choices };
const textQuestion = { responseType: "FREE_TEXT" as const, choices: [] };

function expectInvalid(fn: () => unknown) {
  expect(fn).toThrow(DomainError);
  try {
    fn();
  } catch (e) {
    expect((e as DomainError).status).toBe(422);
  }
}

describe("normalizeGuidedAnswer: single choice", () => {
  it("accepts one valid choice with explanation and importance", () => {
    expect(
      normalizeGuidedAnswer(singleQuestion, {
        outcome: "ANSWERED",
        choiceValues: ["a"],
        text: "  because  ",
        importance: 4,
      }),
    ).toEqual({ outcome: "ANSWERED", choiceValues: ["a"], text: "because", importance: 4 });
  });

  it("rejects more than one choice", () => {
    expectInvalid(() =>
      normalizeGuidedAnswer(singleQuestion, { outcome: "ANSWERED", choiceValues: ["a", "b"] }),
    );
  });

  it("rejects a choice that does not belong to the question", () => {
    expectInvalid(() =>
      normalizeGuidedAnswer(singleQuestion, { outcome: "ANSWERED", choiceValues: ["zzz"] }),
    );
  });

  it("requires a choice when answered", () => {
    expectInvalid(() =>
      normalizeGuidedAnswer(singleQuestion, { outcome: "ANSWERED", text: "only text" }),
    );
  });
});

describe("normalizeGuidedAnswer: multiple choice", () => {
  it("accepts a combination and stores it in the question's display order", () => {
    expect(
      normalizeGuidedAnswer(multiQuestion, { outcome: "ANSWERED", choiceValues: ["c", "a"] })
        .choiceValues,
    ).toEqual(["a", "c"]);
  });

  it("accepts a single selection", () => {
    expect(
      normalizeGuidedAnswer(multiQuestion, { outcome: "ANSWERED", choiceValues: ["b"] })
        .choiceValues,
    ).toEqual(["b"]);
  });

  it("rejects duplicates and unknown values", () => {
    expectInvalid(() =>
      normalizeGuidedAnswer(multiQuestion, { outcome: "ANSWERED", choiceValues: ["a", "a"] }),
    );
    expectInvalid(() =>
      normalizeGuidedAnswer(multiQuestion, { outcome: "ANSWERED", choiceValues: ["a", "nope"] }),
    );
  });

  it("allows an exclusive choice alone but not combined", () => {
    expect(
      normalizeGuidedAnswer(multiQuestion, { outcome: "ANSWERED", choiceValues: ["keep"] })
        .choiceValues,
    ).toEqual(["keep"]);
    expectInvalid(() =>
      normalizeGuidedAnswer(multiQuestion, { outcome: "ANSWERED", choiceValues: ["a", "keep"] }),
    );
  });

  it("requires at least one selection when answered", () => {
    expectInvalid(() =>
      normalizeGuidedAnswer(multiQuestion, { outcome: "ANSWERED", choiceValues: [] }),
    );
  });
});

describe("normalizeGuidedAnswer: skip, not sure, free text", () => {
  it("stores no content at all for a skip", () => {
    expect(
      normalizeGuidedAnswer(multiQuestion, {
        outcome: "SKIPPED",
        choiceValues: ["a", "b"],
        text: "x",
        importance: 5,
      }),
    ).toEqual({ outcome: "SKIPPED", choiceValues: [], text: null, importance: null });
  });

  it("allows 'not sure' with an explanation but no choices", () => {
    expect(
      normalizeGuidedAnswer(singleQuestion, { outcome: "UNSURE", text: "torn on this" }),
    ).toEqual({ outcome: "UNSURE", choiceValues: [], text: "torn on this", importance: null });
    expectInvalid(() =>
      normalizeGuidedAnswer(singleQuestion, { outcome: "UNSURE", choiceValues: ["a"] }),
    );
  });

  it("requires text for free-text questions and treats whitespace as empty", () => {
    expectInvalid(() => normalizeGuidedAnswer(textQuestion, { outcome: "ANSWERED", text: "   " }));
    expect(normalizeGuidedAnswer(textQuestion, { outcome: "ANSWERED", text: "my view" }).text).toBe(
      "my view",
    );
  });
});

describe("guidedResponseInputSchema", () => {
  const base = {
    idempotencyKey: "5f0c7a3e-2b1d-4c3a-9e8f-1a2b3c4d5e6f",
    questionId: "0b6f3c1e-7d2a-4e5b-8c9d-0e1f2a3b4c5d",
    outcome: "ANSWERED",
    choiceValues: ["a", "b"],
  };

  it("accepts a well-formed body", () => {
    expect(guidedResponseInputSchema.safeParse(base).success).toBe(true);
  });

  it.each([0, 6, 2.5])("rejects importance %s", (importance) => {
    expect(guidedResponseInputSchema.safeParse({ ...base, importance }).success).toBe(false);
  });

  it("rejects unknown fields, oversized text and too many selections", () => {
    expect(guidedResponseInputSchema.safeParse({ ...base, party: "x" }).success).toBe(false);
    expect(guidedResponseInputSchema.safeParse({ ...base, text: "x".repeat(2001) }).success).toBe(
      false,
    );
    const many = Array.from({ length: 21 }, (_, i) => `v${i}`);
    expect(guidedResponseInputSchema.safeParse({ ...base, choiceValues: many }).success).toBe(
      false,
    );
  });

  it("no longer accepts the old single choiceValue field", () => {
    const { choiceValues: _omit, ...rest } = base;
    void _omit;
    expect(guidedResponseInputSchema.safeParse({ ...rest, choiceValue: "a" }).success).toBe(false);
  });
});
