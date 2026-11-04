import { z } from "zod";

export const MAX_RESPONSE_TEXT_LENGTH = 2000;
export const MAX_SELECTED_CHOICES = 20;

/** POST /api/responses body for a guided answer. Chat messages arrive in Milestone 3. */
export const guidedResponseInputSchema = z.strictObject({
  idempotencyKey: z.uuid(),
  questionId: z.uuid(),
  outcome: z.enum(["ANSWERED", "SKIPPED", "UNSURE"]),
  choiceValues: z.array(z.string().min(1).max(100)).max(MAX_SELECTED_CHOICES).optional(),
  text: z.string().max(MAX_RESPONSE_TEXT_LENGTH).nullish(),
  importance: z.number().int().min(1).max(5).nullish(),
});

export type GuidedResponseInput = z.infer<typeof guidedResponseInputSchema>;
