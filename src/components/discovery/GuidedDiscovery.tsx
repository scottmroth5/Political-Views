"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoveryProgress, QuestionDto } from "@/domain/questions/question-types";
import { ApiError, apiFetch } from "@/lib/api-client";

type Outcome = "ANSWERED" | "SKIPPED" | "UNSURE";

const IMPORTANCE_LABELS = ["Not very", "Somewhat", "Moderately", "Very", "Extremely"];

export function GuidedDiscovery() {
  const router = useRouter();
  const [question, setQuestion] = useState<QuestionDto | null>(null);
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [explanation, setExplanation] = useState("");
  const [importance, setImportance] = useState<number | null>(null);
  // One key per question; reused if a submission is retried after a network failure.
  const idempotencyKey = useRef<string>("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ question: QuestionDto | null; progress: DiscoveryProgress }>(
        "/api/questions/next",
      );
      setQuestion(data.question);
      setProgress(data.progress);
      setSelected([]);
      setExplanation("");
      setImportance(null);
      idempotencyKey.current = crypto.randomUUID();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/?expired=1");
        return;
      }
      setError(e instanceof Error ? e.message : "Could not load the next question.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  // Move focus to the new question so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (!loading && question) headingRef.current?.focus();
  }, [loading, question]);

  const multi = question?.responseType === "MULTI_CHOICE";

  function toggleChoice(value: string) {
    if (!question) return;
    if (!multi) {
      setSelected([value]);
      return;
    }
    setSelected((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      const isExclusive = (v: string) => question.choices.some((c) => c.value === v && c.exclusive);
      // An exclusive choice replaces everything; picking anything else clears it.
      if (isExclusive(value)) return [value];
      return [...prev.filter((v) => !isExclusive(v)), value];
    });
  }

  async function submit(outcome: Outcome) {
    if (!question) return;
    if (outcome === "ANSWERED" && selected.length === 0) {
      setError(
        multi
          ? "Select at least one choice, or choose “Not sure” or “Skip”."
          : "Select one of the choices, or choose “Not sure” or “Skip”.",
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/responses", {
        method: "POST",
        body: {
          idempotencyKey: idempotencyKey.current,
          questionId: question.id,
          outcome,
          choiceValues: outcome === "ANSWERED" ? selected : [],
          text: outcome === "SKIPPED" ? null : explanation || null,
          importance: outcome === "SKIPPED" ? null : importance,
        },
      });
      router.refresh(); // update the server-rendered answer list
      await loadNext();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/?expired=1");
        return;
      }
      setError(e instanceof Error ? e.message : "Your answer was not saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !question) {
    return <p aria-live="polite">Loading question…</p>;
  }

  return (
    <section aria-labelledby="question-heading" className="space-y-4">
      {progress && (
        <p className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
          {progress.respondedQuestions} of {progress.totalQuestions} questions ·{" "}
          {progress.categoriesTouched} of {progress.categoriesTotal} issue areas
        </p>
      )}

      {!question ? (
        <div className="rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2
            id="question-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold"
          >
            You&apos;ve reached the end of the available guided questions
          </h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Your answers are saved. A preliminary profile preview is planned for a later release and
            is not available yet.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit("ANSWERED");
          }}
          className="space-y-5 rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {question.category.label} · {question.topic.label}
          </p>

          <fieldset>
            <legend>
              <h2
                id="question-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold"
              >
                {question.prompt}
              </h2>
            </legend>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {multi ? "Select all that apply." : "Select one."}
            </p>
            <div className="mt-3 space-y-2">
              {question.choices.map((c) => (
                <label
                  key={c.value}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40 dark:border-slate-700 dark:has-[:checked]:bg-teal-950"
                >
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name="choice"
                    value={c.value}
                    checked={selected.includes(c.value)}
                    onChange={() => toggleChoice(c.value)}
                    className="mt-1 accent-accent"
                  />
                  <span>
                    {c.label}
                    {multi && c.exclusive && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        Can&apos;t be combined with other choices
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {question.explanationPrompt && (
            <div>
              <label htmlFor="explanation" className="block text-sm font-medium">
                {question.explanationPrompt}
              </label>
              <textarea
                id="explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                maxLength={2000}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-950"
              />
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-medium">
              How important is this issue to you? (optional)
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {IMPORTANCE_LABELS.map((label, i) => (
                <label
                  key={label}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm has-[:checked]:border-accent dark:border-slate-700"
                >
                  <input
                    type="radio"
                    name="importance"
                    value={i + 1}
                    checked={importance === i + 1}
                    onChange={() => setImportance(i + 1)}
                    className="accent-accent"
                  />
                  {i + 1} · {label}
                </label>
              ))}
            </div>
          </fieldset>

          <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
            {error}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save answer"}
            </button>
            <button
              type="button"
              onClick={() => void submit("UNSURE")}
              disabled={submitting}
              className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Not sure
            </button>
            <button
              type="button"
              onClick={() => void submit("SKIPPED")}
              disabled={submitting}
              className="rounded-md px-4 py-2 font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950 disabled:opacity-60 dark:text-slate-300 dark:hover:text-white"
            >
              Skip
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
