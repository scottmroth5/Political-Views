import type { BeliefDto } from "@/domain/beliefs/belief-service";

/**
 * The preview appears after this many answered (not skipped or "not sure") questions (PRD ~3-5),
 * or as soon as the user has confirmed a belief, so confirmed beliefs never disappear from view.
 */
export const PREVIEW_THRESHOLD = 3;

export interface CategoryCoverageInput {
  id: string;
  slug: string;
  label: string;
  order: number;
  questionsTotal: number;
  questionsAnswered: number;
}

export interface ProfileCategory {
  slug: string;
  label: string;
  questionsTotal: number;
  questionsAnswered: number;
  /** Confirmed first, then suggestions; rejected beliefs are listed separately. */
  confirmed: BeliefDto[];
  suggested: BeliefDto[];
}

export interface ProfileDto {
  /** Always true in Phase 1: a profile is a draft the user keeps refining. */
  preliminary: true;
  ready: boolean;
  answeredQuestions: number;
  previewThreshold: number;
  counts: { confirmed: number; suggested: number; rejected: number; needsReview: number };
  categories: ProfileCategory[];
  /** Issue areas with no answered question yet. */
  gaps: { slug: string; label: string }[];
  rejected: BeliefDto[];
}

export function buildProfile(
  categories: readonly CategoryCoverageInput[],
  beliefs: readonly (BeliefDto & { categoryId: string | null })[],
): ProfileDto {
  const sorted = [...categories].sort(
    (a, b) => a.order - b.order || a.label.localeCompare(b.label),
  );
  const byCategory = new Map<string, ProfileCategory>(
    sorted.map((c) => [
      c.id,
      {
        slug: c.slug,
        label: c.label,
        questionsTotal: c.questionsTotal,
        questionsAnswered: c.questionsAnswered,
        confirmed: [],
        suggested: [],
      },
    ]),
  );
  const other: ProfileCategory = {
    slug: "other",
    label: "Other",
    questionsTotal: 0,
    questionsAnswered: 0,
    confirmed: [],
    suggested: [],
  };
  const rejected: BeliefDto[] = [];

  for (const { categoryId, ...belief } of beliefs) {
    if (belief.status === "REJECTED") {
      rejected.push(belief);
      continue;
    }
    const group = (categoryId && byCategory.get(categoryId)) || other;
    (belief.status === "CONFIRMED" ? group.confirmed : group.suggested).push(belief);
  }

  const answeredQuestions = sorted.reduce((n, c) => n + c.questionsAnswered, 0);
  const groups = [
    ...byCategory.values(),
    ...(other.confirmed.length + other.suggested.length ? [other] : []),
  ];
  const confirmed = groups.reduce((n, g) => n + g.confirmed.length, 0);
  const suggested = groups.reduce((n, g) => n + g.suggested.length, 0);
  const needsReview = groups.reduce(
    (n, g) => n + g.confirmed.filter((b) => b.sourceChanged).length,
    0,
  );

  return {
    preliminary: true,
    ready: answeredQuestions >= PREVIEW_THRESHOLD || confirmed > 0,
    answeredQuestions,
    previewThreshold: PREVIEW_THRESHOLD,
    counts: { confirmed, suggested, rejected: rejected.length, needsReview },
    categories: groups,
    gaps: sorted
      .filter((c) => c.questionsAnswered === 0)
      .map(({ slug, label }) => ({ slug, label })),
    rejected,
  };
}
