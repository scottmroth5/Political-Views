import { getEnv } from "@/lib/env";
import {
  findGuidedResponse,
  listGuidedResponseSummaries,
} from "@/domain/responses/response-repository";
import {
  countActiveCategories,
  findServableQuestion,
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
    const question = byId.get(r.questionId);
    // Answers to archived (or not yet reviewed) questions are kept but don't count toward progress.
    if (!question) continue;
    respondedQuestionIds.add(r.questionId);
    if (r.outcome !== "SKIPPED") answeredQuestions++;
    const categoryId = question.topic.categoryId;
    responsesPerCategory.set(categoryId, (responsesPerCategory.get(categoryId) ?? 0) + 1);
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

/** The session's earlier answer to a question, for pre-filling the edit form. */
export interface ExistingAnswerDto {
  outcome: "ANSWERED" | "SKIPPED" | "UNSURE";
  choiceValues: string[];
  text: string | null;
  importance: number | null;
}

/**
 * A servable question together with this session's answer to it (null if not answered yet), or
 * null when the question is not available. Choices no longer offered (after a question edit) are
 * dropped from the pre-fill.
 */
export async function getQuestionForEdit(
  sessionId: string,
  questionId: string,
): Promise<{ question: QuestionDto; answer: ExistingAnswerDto | null } | null> {
  const source = await findServableQuestion(questionId, getEnv().REQUIRE_REVIEWED_QUESTIONS);
  if (!source) return null;
  const question = toQuestionDto(source);
  const response = await findGuidedResponse(sessionId, questionId);
  const offered = new Set(question.choices.map((c) => c.value));
  return {
    question,
    answer: response
      ? {
          outcome: response.outcome,
          choiceValues: response.choiceValues.filter((v) => offered.has(v)),
          text: response.text,
          importance: response.importance,
        }
      : null,
  };
}
