import { DomainError } from "@/domain/errors";
import type { QuestionChoice, ResponseTypeValue } from "@/domain/questions/question-types";
import type { GuidedResponseInput } from "./response-schema";

export interface NormalizedAnswer {
  outcome: GuidedResponseInput["outcome"];
  /** In the question's display order, so equal selections always compare equal. */
  choiceValues: string[];
  text: string | null;
  importance: number | null;
}

function invalid(message: string): never {
  throw new DomainError("INVALID_ANSWER", message, 422);
}

/**
 * Checks an answer against the question it targets and normalizes it.
 * A skip stores no content at all: skipping means the user chose not to share.
 */
export function normalizeGuidedAnswer(
  question: { responseType: ResponseTypeValue; choices: QuestionChoice[] },
  input: Pick<GuidedResponseInput, "outcome" | "choiceValues" | "text" | "importance">,
): NormalizedAnswer {
  const text = input.text?.trim() ? input.text.trim() : null;
  const selected = input.choiceValues ?? [];
  const importance = input.importance ?? null;

  switch (input.outcome) {
    case "SKIPPED":
      return { outcome: "SKIPPED", choiceValues: [], text: null, importance: null };

    case "UNSURE":
      if (selected.length > 0) invalid("A 'not sure' response cannot include selected choices.");
      return { outcome: "UNSURE", choiceValues: [], text, importance };

    case "ANSWERED": {
      if (question.responseType === "FREE_TEXT") {
        if (selected.length > 0) invalid("This question does not accept choices.");
        if (text === null) invalid("Enter a response, or choose 'not sure' or skip.");
        return { outcome: "ANSWERED", choiceValues: [], text, importance };
      }

      if (selected.length === 0) invalid("Select a choice, or choose 'not sure' or skip.");
      if (new Set(selected).size !== selected.length) invalid("Each choice can be selected once.");
      const unknown = selected.some((v) => !question.choices.some((c) => c.value === v));
      if (unknown) invalid("A selected choice is not valid for this question.");

      if (question.responseType === "SINGLE_CHOICE" && selected.length > 1) {
        invalid("This question accepts only one choice.");
      }
      const exclusive = question.choices.find((c) => c.exclusive && selected.includes(c.value));
      if (exclusive && selected.length > 1) {
        invalid(`"${exclusive.label}" cannot be combined with other choices.`);
      }

      const ordered = question.choices.map((c) => c.value).filter((v) => selected.includes(v));
      return { outcome: "ANSWERED", choiceValues: ordered, text, importance };
    }
  }
}
