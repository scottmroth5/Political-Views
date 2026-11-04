import { getEnv } from "@/lib/env";
import { listGuidedResponseSummaries } from "@/domain/responses/response-repository";
import {
  countActiveCategories,
  listServableQuestions,
  type ServableQuestion,
} from "./question-repository";
import { parseChoices, type DiscoveryProgress, type QuestionDto } from "./question-types";
import { selectNextQuestion, type CandidateQuestion } from "./selection";

export function toQuestionDto(q: ServableQuestion): QuestionDto {
  return {
    id: q.id,
    version: q.version,
    prompt: q.prompt,
    explanationPrompt: q.explanationPrompt,
    responseType: q.responseType,
    choices: parseChoices(q.choices),
    category: { slug: q.topic.category.slug, label: q.topic.category.label },
    topic: { slug: q.topic.slug, label: q.topic.label },
  };
}

export async function getNextQuestion(
  sessionId: string,
): Promise<{ question: QuestionDto | null; progress: DiscoveryProgress }> {
  const { REQUIRE_REVIEWED_QUESTIONS } = getEnv();
  const [questions, responses, categoriesTotal] = await Promise.all([
    listServableQuestions(REQUIRE_REVIEWED_QUESTIONS),
    listGuidedResponseSummaries(sessionId),
    countActiveCategories(),
  ]);

  const byId = new Map(questions.map((q) => [q.id, q]));
  const respondedQuestionIds = new Set<string>();
  const responsesPerCategory = new Map<string, number>();
  let answeredQuestions = 0;

  for (const r of responses) {
    respondedQuestionIds.add(r.questionId);
    if (r.outcome !== "SKIPPED") answeredQuestions++;
    const question = byId.get(r.questionId);
    if (question) {
      const categoryId = question.topic.categoryId;
      responsesPerCategory.set(categoryId, (responsesPerCategory.get(categoryId) ?? 0) + 1);
    }
  }

  const candidates: (CandidateQuestion & { source: ServableQuestion })[] = questions.map((q) => ({
    id: q.id,
    categoryId: q.topic.categoryId,
    categoryOrder: q.topic.category.displayOrder,
    topicOrder: q.topic.displayOrder,
    questionOrder: q.displayOrder,
    source: q,
  }));

  const next = selectNextQuestion(candidates, { respondedQuestionIds, responsesPerCategory });

  return {
    question: next ? toQuestionDto(next.source) : null,
    progress: {
      totalQuestions: questions.length,
      respondedQuestions: respondedQuestionIds.size,
      answeredQuestions,
      categoriesTouched: responsesPerCategory.size,
      categoriesTotal,
    },
  };
}
