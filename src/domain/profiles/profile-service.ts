import { listSessionBeliefs } from "@/domain/beliefs/belief-repository";
import { toBeliefDto } from "@/domain/beliefs/belief-service";
import {
  listActiveCategories,
  listServableQuestions,
} from "@/domain/questions/question-repository";
import { listGuidedResponseSummaries } from "@/domain/responses/response-repository";
import { getEnv } from "@/lib/env";
import { buildProfile, type ProfileDto } from "./profile-builder";

/** The session's preliminary profile: beliefs by issue area, plus coverage of the questions. */
export async function getProfile(sessionId: string): Promise<ProfileDto> {
  const [categories, questions, responses, beliefs] = await Promise.all([
    listActiveCategories(),
    listServableQuestions(getEnv().REQUIRE_REVIEWED_QUESTIONS),
    listGuidedResponseSummaries(sessionId),
    listSessionBeliefs(sessionId),
  ]);

  const answered = new Set(
    responses.filter((r) => r.outcome === "ANSWERED").map((r) => r.questionId),
  );
  const coverage = categories.map((c) => {
    const inCategory = questions.filter((q) => q.topic.categoryId === c.id);
    return {
      id: c.id,
      slug: c.slug,
      label: c.label,
      order: c.displayOrder,
      questionsTotal: inCategory.length,
      questionsAnswered: inCategory.filter((q) => answered.has(q.id)).length,
    };
  });

  return buildProfile(
    coverage,
    beliefs.map((b) => ({ ...toBeliefDto(b), categoryId: b.topic?.categoryId ?? null })),
  );
}
