import { z } from "zod";
import { DomainError } from "@/domain/errors";
import type { QuestionChoice } from "./question-types";

export const MAX_PROMPT_LENGTH = 300;
export const MAX_CHOICE_LABEL_LENGTH = 300;
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 12;

/** POST /api/admin/questions body: a new question, optionally a copy of an existing one. */
export const questionDraftSchema = z.strictObject({
  categoryId: z.uuid(),
  topic: z.union([
    z.strictObject({ id: z.uuid() }),
    z.strictObject({ newLabel: z.string().trim().min(2).max(100) }),
  ]),
  prompt: z.string().trim().min(10).max(MAX_PROMPT_LENGTH),
  explanationPrompt: z.string().trim().max(MAX_PROMPT_LENGTH).nullable(),
  responseType: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE"]),
  choices: z
    .array(
      z.strictObject({
        label: z.string().trim().min(1).max(MAX_CHOICE_LABEL_LENGTH),
        exclusive: z.boolean().optional(),
      }),
    )
    .min(MIN_CHOICES)
    .max(MAX_CHOICES),
  copiedFromId: z.uuid().nullable().optional(),
  /** With copiedFromId: archive the original in the same step. */
  archiveOriginal: z.boolean().optional(),
});

export type QuestionDraft = z.infer<typeof questionDraftSchema>;

/** Lowercase, hyphenated ASCII for slugs and choice values. */
export function slugify(text: string, maxLength = 60): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "item";
}

function invalid(message: string): never {
  throw new DomainError("INVALID_QUESTION", message, 422);
}

/**
 * Checks the choices and gives each a stable value from its label. Exclusive choices exist only on
 * multi-select questions and need at least two other choices to stand apart from.
 */
export function buildChoices(
  responseType: QuestionDraft["responseType"],
  choices: QuestionDraft["choices"],
): QuestionChoice[] {
  const seen = new Set<string>();
  for (const c of choices) {
    const key = c.label.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) invalid(`Two choices have the same wording: "${c.label}".`);
    seen.add(key);
  }
  if (responseType === "SINGLE_CHOICE" && choices.some((c) => c.exclusive)) {
    invalid("Only multi-select questions can have choices that can't be combined.");
  }
  if (
    responseType === "MULTI_CHOICE" &&
    choices.some((c) => c.exclusive) &&
    choices.filter((c) => !c.exclusive).length < 2
  ) {
    invalid("A multi-select question needs at least two choices that can be combined.");
  }

  const values = new Set<string>();
  return choices.map((c) => {
    const base = slugify(c.label, 60);
    let value = base;
    for (let n = 2; values.has(value); n++) value = `${base}-${n}`;
    values.add(value);
    return { value, label: c.label, ...(c.exclusive ? { exclusive: true } : {}) };
  });
}
