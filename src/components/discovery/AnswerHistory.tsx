import Link from "next/link";
import type { GuidedAnswerSummary } from "@/domain/responses/response-service";

const OUTCOME_LABEL = { ANSWERED: "Answered", UNSURE: "Not sure", SKIPPED: "Skipped" } as const;

export function AnswerHistory({
  answers,
  editingQuestionId,
}: {
  answers: GuidedAnswerSummary[];
  editingQuestionId?: string;
}) {
  if (answers.length === 0) return null;
  return (
    <section aria-labelledby="answers-heading" className="mt-10">
      <h2 id="answers-heading" className="text-lg font-semibold">
        Your answers so far
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        These are your raw answers, not conclusions about your beliefs. You can change any of them.
      </p>
      <ol className="mt-3 space-y-3">
        {answers.map((a) => (
          <li
            key={a.responseId}
            className="rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {a.categoryLabel} · {OUTCOME_LABEL[a.outcome]}
                {a.importance !== null && ` · Importance ${a.importance}/5`}
              </p>
              {!a.changeable ? (
                <span className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">
                  Question retired
                </span>
              ) : a.questionId === editingQuestionId ? (
                <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Changing above
                </span>
              ) : (
                <Link
                  href={`/discovery/guided?edit=${a.questionId}`}
                  className="shrink-0 text-sm font-medium text-accent-strong underline underline-offset-4 dark:text-teal-300"
                >
                  Change<span className="sr-only"> your answer to: {a.prompt}</span>
                </Link>
              )}
            </div>
            <p className="mt-1 font-medium">{a.prompt}</p>
            {a.choiceLabels.length === 1 && <p className="mt-1">{a.choiceLabels[0]}</p>}
            {a.choiceLabels.length > 1 && (
              <ul className="mt-1 list-disc pl-5">
                {a.choiceLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            )}
            {a.text && (
              <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                “{a.text}”
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
