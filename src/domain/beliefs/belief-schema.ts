import { z } from "zod";
import { DomainError } from "@/domain/errors";
import type { BeliefStatusValue } from "./guided-derivation";

export const MAX_POSITION_LENGTH = 300;
export const MAX_NUANCE_LENGTH = 1000;

const rating = z.number().int().min(1).max(5).nullable();

/** PATCH /api/beliefs/:id body. `version` is the belief version the client last saw. */
export const beliefPatchSchema = z
  .strictObject({
    version: z.number().int().min(1),
    status: z.enum(["CONFIRMED", "REJECTED"]).optional(),
    position: z.string().trim().min(1).max(MAX_POSITION_LENGTH).optional(),
    nuance: z.string().trim().max(MAX_NUANCE_LENGTH).nullable().optional(),
    importance: rating.optional(),
    conviction: rating.optional(),
  })
  .refine((p) => Object.keys(p).some((k) => k !== "version"), { message: "Nothing to change." });

export type BeliefPatch = z.infer<typeof beliefPatchSchema>;

export interface BeliefValues {
  status: BeliefStatusValue;
  position: string;
  nuance: string | null;
  importance: number | null;
  conviction: number | null;
}

/**
 * The belief after a user's change, or null when nothing would change.
 * - Rewording (position or nuance) confirms the belief unless the same request rejects it.
 * - Importance and conviction belong to beliefs the user holds, so they need a confirmed belief.
 */
export function applyBeliefPatch(current: BeliefValues, patch: BeliefPatch): BeliefValues | null {
  const reworded = patch.position !== undefined || patch.nuance !== undefined;
  const next: BeliefValues = {
    status: patch.status ?? (reworded ? "CONFIRMED" : current.status),
    position: patch.position ?? current.position,
    nuance: patch.nuance === undefined ? current.nuance : patch.nuance || null,
    importance: patch.importance === undefined ? current.importance : patch.importance,
    conviction: patch.conviction === undefined ? current.conviction : patch.conviction,
  };
  const rated =
    (patch.importance !== undefined && patch.importance !== null) ||
    (patch.conviction !== undefined && patch.conviction !== null);
  if (rated && next.status !== "CONFIRMED") {
    throw new DomainError(
      "BELIEF_NOT_CONFIRMED",
      "Confirm this belief before rating its importance or how sure you are.",
      422,
    );
  }
  const changed = (Object.keys(next) as (keyof BeliefValues)[]).some((k) => next[k] !== current[k]);
  return changed ? next : null;
}
