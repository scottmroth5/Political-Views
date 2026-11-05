import { createHash } from "node:crypto";
import reviewFile from "./editorial-reviews.json";
import type { SeedQuestion } from "./seed-data";

/**
 * Editorial review records (docs/editorial-review.md).
 *
 * A review covers one question's exact content, identified by a fingerprint of everything a user
 * sees: prompt, explanation prompt, single vs. multi-select, and each choice's value, label,
 * exclusivity and order. If any of that changes after review, the fingerprint no longer matches
 * and the question is DRAFT again until someone reviews the new wording. The reviews file is the
 * only source of editorial status: seeding sets REVIEWED or DRAFT from it every time.
 */

export interface QuestionContent {
  prompt: string;
  explanationPrompt: string | null;
  responseType: "SINGLE_CHOICE" | "MULTI_CHOICE";
  choices: { value: string; label: string; exclusive?: true }[];
}

export interface EditorialReview {
  slug: string;
  /** contentHash() of the wording that was reviewed. */
  contentHash: string;
  /** YYYY-MM-DD. */
  reviewedOn: string;
  /** Optional, public: what was checked or changed. Never names or personal details. */
  note?: string;
}

export function questionContent(q: SeedQuestion): QuestionContent {
  return {
    prompt: q.prompt,
    explanationPrompt: q.explanationPrompt ?? null,
    responseType: q.multiple ? "MULTI_CHOICE" : "SINGLE_CHOICE",
    choices: q.choices.map((ch) => ({
      value: ch.value,
      label: ch.label,
      ...(ch.exclusive ? { exclusive: true as const } : {}),
    })),
  };
}

/** Short, stable fingerprint of a question's user-visible content (independent of key order). */
export function contentHash(content: QuestionContent): string {
  const canonical = JSON.stringify([
    content.prompt,
    content.explanationPrompt,
    content.responseType,
    content.choices.map((c) => [c.value, c.label, c.exclusive === true]),
  ]);
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export type ReviewState = "reviewed" | "changed-since-review" | "not-reviewed";

export function reviewState(
  q: SeedQuestion,
  reviews: readonly EditorialReview[],
): { state: ReviewState; review: EditorialReview | null } {
  const review = reviews.find((r) => r.slug === q.slug) ?? null;
  if (!review) return { state: "not-reviewed", review };
  const state =
    review.contentHash === contentHash(questionContent(q)) ? "reviewed" : "changed-since-review";
  return { state, review };
}

export function editorialStatus(
  q: SeedQuestion,
  reviews: readonly EditorialReview[],
): "REVIEWED" | "DRAFT" {
  return reviewState(q, reviews).state === "reviewed" ? "REVIEWED" : "DRAFT";
}

/** The committed reviews (prisma/editorial-reviews.json), bundled into the seed script. */
export const committedReviews: readonly EditorialReview[] = reviewFile.reviews as EditorialReview[];
