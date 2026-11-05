"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export interface CategoryOption {
  id: string;
  label: string;
  topics: { id: string; label: string }[];
}

export interface QuestionFormInitial {
  categoryId: string;
  topicId: string;
  prompt: string;
  explanationPrompt: string;
  responseType: "SINGLE_CHOICE" | "MULTI_CHOICE";
  choices: { label: string; exclusive: boolean }[];
}

const NEW_TOPIC = "__new__";
const field =
  "mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-950";
const small =
  "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800";

/** Adds a question. With `copyOf`, starts from that question's content; the original never changes. */
export function QuestionForm({
  categories,
  initial,
  copyOf,
}: {
  categories: CategoryOption[];
  initial: QuestionFormInitial;
  copyOf: { id: string; prompt: string; archived: boolean } | null;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [topicId, setTopicId] = useState(initial.topicId);
  const [newTopic, setNewTopic] = useState("");
  const [prompt, setPrompt] = useState(initial.prompt);
  const [explanationPrompt, setExplanationPrompt] = useState(initial.explanationPrompt);
  const [responseType, setResponseType] = useState(initial.responseType);
  const nextKey = useRef(0);
  const [choices, setChoices] = useState(() =>
    initial.choices.map((c) => ({ ...c, key: nextKey.current++ })),
  );
  const [archiveOriginal, setArchiveOriginal] = useState(copyOf !== null && !copyOf.archived);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = categories.find((c) => c.id === categoryId);
  const multi = responseType === "MULTI_CHOICE";

  const update = (i: number, change: Partial<{ label: string; exclusive: boolean }>) =>
    setChoices((list) => list.map((c, j) => (j === i ? { ...c, ...change } : c)));
  const move = (i: number, by: -1 | 1) =>
    setChoices((list) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by]!, next[i]!];
      return next;
    });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/admin/questions", {
        method: "POST",
        body: {
          categoryId,
          topic: topicId === NEW_TOPIC ? { newLabel: newTopic } : { id: topicId },
          prompt,
          explanationPrompt: explanationPrompt.trim() || null,
          responseType,
          choices: choices.map((c) => ({ label: c.label, exclusive: multi && c.exclusive })),
          copiedFromId: copyOf?.id ?? null,
          archiveOriginal: copyOf ? archiveOriginal : false,
        },
      });
      router.replace("/admin?show=draft");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The question was not added.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {copyOf && (
        <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-800">
          Copy of: <strong>{copyOf.prompt}</strong>. This adds a new question; the original is not
          changed.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium">
            Issue area
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setTopicId(
                categories.find((c) => c.id === e.target.value)?.topics[0]?.id ?? NEW_TOPIC,
              );
            }}
            className={field}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="topic" className="block text-sm font-medium">
            Topic
          </label>
          <select
            id="topic"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className={field}
          >
            {category?.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
            <option value={NEW_TOPIC}>New topic…</option>
          </select>
        </div>
      </div>

      {topicId === NEW_TOPIC && (
        <div>
          <label htmlFor="new-topic" className="block text-sm font-medium">
            New topic name
          </label>
          <input
            id="new-topic"
            required
            minLength={2}
            maxLength={100}
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            className={field}
          />
        </div>
      )}

      <div>
        <label htmlFor="prompt" className="block text-sm font-medium">
          Question
        </label>
        <textarea
          id="prompt"
          required
          minLength={10}
          maxLength={300}
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={field}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Answer type</legend>
        <div className="mt-1 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="responseType"
              checked={!multi}
              onChange={() => setResponseType("SINGLE_CHOICE")}
              className="accent-accent"
            />
            Single choice (points on one scale)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="responseType"
              checked={multi}
              onChange={() => setResponseType("MULTI_CHOICE")}
              className="accent-accent"
            />
            Multi-select (approaches that can be combined)
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Choices (in the order shown)</legend>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Each choice becomes a suggested belief, so it should read as a position on its own.
          &ldquo;Not sure&rdquo; and &ldquo;Skip&rdquo; are always added by the app.
        </p>
        <ol className="mt-2 space-y-2">
          {choices.map((c, i) => (
            <li
              key={c.key}
              className="rounded-md border border-slate-200 p-2 dark:border-slate-700"
            >
              <label htmlFor={`choice-${c.key}`} className="sr-only">
                Choice {i + 1}
              </label>
              <input
                id={`choice-${c.key}`}
                required
                maxLength={300}
                value={c.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {multi && (
                  <label className="mr-2 flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={c.exclusive}
                      onChange={(e) => update(i, { exclusive: e.target.checked })}
                      className="accent-accent"
                    />
                    Can&apos;t be combined with other choices
                  </label>
                )}
                <button
                  type="button"
                  className={small}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move choice ${i + 1} up`}
                >
                  Up
                </button>
                <button
                  type="button"
                  className={small}
                  disabled={i === choices.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move choice ${i + 1} down`}
                >
                  Down
                </button>
                <button
                  type="button"
                  className={small}
                  disabled={choices.length <= 2}
                  onClick={() => setChoices((list) => list.filter((_, j) => j !== i))}
                  aria-label={`Remove choice ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className={`${small} mt-2`}
          disabled={choices.length >= 12}
          onClick={() =>
            setChoices((list) => [...list, { label: "", exclusive: false, key: nextKey.current++ }])
          }
        >
          Add a choice
        </button>
      </fieldset>

      <div>
        <label htmlFor="explanation-prompt" className="block text-sm font-medium">
          Explanation prompt (optional)
        </label>
        <input
          id="explanation-prompt"
          maxLength={300}
          value={explanationPrompt}
          onChange={(e) => setExplanationPrompt(e.target.value)}
          className={field}
        />
      </div>

      {copyOf && !copyOf.archived && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={archiveOriginal}
            onChange={(e) => setArchiveOriginal(e.target.checked)}
            className="mt-1 accent-accent"
          />
          <span>
            Archive the original when this is added (it stops being asked; its answers are kept)
          </span>
        </label>
      )}

      <p role="alert" className="text-sm text-amber-800 empty:hidden dark:text-amber-300">
        {error}
      </p>

      <p className="text-xs text-slate-600 dark:text-slate-300">
        New questions start as drafts. Once added, a question can&apos;t be edited, only copied or
        archived, so check the wording first.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add question"}
        </button>
        <Link href="/admin" className="px-4 py-2 font-medium underline underline-offset-4">
          Cancel
        </Link>
      </div>
    </form>
  );
}
