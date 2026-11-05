import { describe, expect, it } from "vitest";
import {
  ADMIN_HASH_PATTERN,
  hashAdminPassword,
  verifyAdminPassword,
} from "@/domain/admin/admin-password";
import { DomainError } from "@/domain/errors";
import { buildChoices, questionDraftSchema, slugify } from "@/domain/questions/question-draft";

describe("admin password hashing", () => {
  it("verifies the right password only, with a salted, $-free format", async () => {
    const hash = hashAdminPassword("correct horse battery staple");
    expect(hash).toMatch(ADMIN_HASH_PATTERN);
    expect(hash).not.toContain("$");
    expect(hashAdminPassword("correct horse battery staple")).not.toBe(hash); // new salt each time
    expect(await verifyAdminPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyAdminPassword("correct horse battery stapler", hash)).toBe(false);
    expect(await verifyAdminPassword("anything", "not-a-hash")).toBe(false);
  });
});

describe("slugify", () => {
  it("makes short, ASCII, hyphenated values", () => {
    expect(slugify("Keep the current approach!")).toBe("keep-the-current-approach");
    expect(slugify("Café & résumé — 2025")).toBe("cafe-resume-2025");
    expect(slugify("!!!")).toBe("item");
    expect(slugify("a".repeat(100)).length).toBe(60);
  });
});

describe("buildChoices", () => {
  it("gives each choice a unique value from its label, keeping order", () => {
    expect(
      buildChoices("MULTI_CHOICE", [
        { label: "Raise taxes" },
        { label: "Raise taxes!" },
        { label: "Keep it the same", exclusive: true },
      ]),
    ).toEqual([
      { value: "raise-taxes", label: "Raise taxes" },
      { value: "raise-taxes-2", label: "Raise taxes!" },
      { value: "keep-it-the-same", label: "Keep it the same", exclusive: true },
    ]);
  });

  it("rejects duplicate wording, ignoring case and spacing", () => {
    expect(() =>
      buildChoices("SINGLE_CHOICE", [{ label: "More  funding" }, { label: "more funding" }]),
    ).toThrow(DomainError);
  });

  it("allows exclusive choices only on multi-select, with two combinable choices", () => {
    expect(() =>
      buildChoices("SINGLE_CHOICE", [{ label: "A" }, { label: "B", exclusive: true }]),
    ).toThrow(/multi-select/);
    expect(() =>
      buildChoices("MULTI_CHOICE", [{ label: "A" }, { label: "B", exclusive: true }]),
    ).toThrow(/two choices/);
  });
});

describe("questionDraftSchema", () => {
  const base = {
    categoryId: "00000000-0000-4000-8000-000000000001",
    topic: { id: "00000000-0000-4000-8000-000000000002" },
    prompt: "What should happen with this policy?",
    explanationPrompt: null,
    responseType: "SINGLE_CHOICE",
    choices: [{ label: "One" }, { label: "Two" }],
  };

  it("accepts a valid draft and trims text", () => {
    const parsed = questionDraftSchema.parse({ ...base, prompt: `  ${base.prompt}  ` });
    expect(parsed.prompt).toBe(base.prompt);
  });

  it("rejects bad input", () => {
    for (const bad of [
      { ...base, prompt: "Short?" },
      { ...base, choices: [{ label: "Only" }] },
      { ...base, choices: Array.from({ length: 13 }, (_, i) => ({ label: `C${i}` })) },
      { ...base, responseType: "FREE_TEXT" },
      { ...base, topic: { newLabel: "x" } },
      { ...base, extra: true },
      { ...base, choices: [{ label: "   " }, { label: "Two" }] },
    ]) {
      expect(questionDraftSchema.safeParse(bad).success).toBe(false);
    }
  });
});
