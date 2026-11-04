import { z } from "zod";

export const questionChoiceSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(300),
  /** Multi-select only: cannot be combined with other choices (e.g. "keep the current approach"). */
  exclusive: z.boolean().optional(),
});
export const questionChoicesSchema = z.array(questionChoiceSchema);
export type QuestionChoice = z.infer<typeof questionChoiceSchema>;

export type ResponseTypeValue = "SINGLE_CHOICE" | "MULTI_CHOICE" | "FREE_TEXT";

/** Public shape of a question sent to the client. */
export interface QuestionDto {
  id: string;
  version: number;
  prompt: string;
  explanationPrompt: string | null;
  responseType: ResponseTypeValue;
  choices: QuestionChoice[];
  category: { slug: string; label: string };
  topic: { slug: string; label: string };
}

export interface DiscoveryProgress {
  totalQuestions: number;
  respondedQuestions: number;
  answeredQuestions: number;
  categoriesTouched: number;
  categoriesTotal: number;
}

export function parseChoices(raw: unknown): QuestionChoice[] {
  if (raw == null) return [];
  const parsed = questionChoicesSchema.safeParse(raw);
  // Malformed seed content is a server bug; fail closed with no choices.
  return parsed.success ? parsed.data : [];
}
