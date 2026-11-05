"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BeliefDto } from "@/domain/beliefs/belief-service";
import { track } from "@/lib/analytics";
import { ApiError, apiFetch } from "@/lib/api-client";

const IMPORTANCE = ["Not very", "Somewhat", "Moderately", "Very", "Extremely"];
const CONVICTION = [
  "Not very sure",
  "Somewhat sure",
  "Fairly sure",
  "Very sure",
  "Completely sure",
];

type Change = {
  status?: "CONFIRMED" | "REJECTED";
  position?: string;
  nuance?: string | null;
  importance?: number | null;
  conviction?: number | null;
};
type Action = "confirmed" | "rejected" | "edited" | "rated";

const button =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800";

export function BeliefCard({ belief }: { belief: BeliefDto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [position, setPosition] = useState(belief.position);
  const [nuance, setNuance] = useState(belief.nuance ?? "");
  const ids = { position: `position-${belief.id}`, nuance: `nuance-${belief.id}` };
  // Repeated buttons ("Confirm", ...) are tied to the belief they act on for screen readers.
  const describedBy = { "aria-describedby": `belief-${belief.id}` };

  async function save(change: Change, action: Action) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/beliefs/${belief.id}`, {
        method: "PATCH",
        body: { version: belief.version, ...change },
      });
      track("belief_reviewed", { action });
      setEditing(false);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/?expired=1");
        return;
      }
      setError(e instanceof Error ? e.message : "That change was not saved. Please try again.");
      if (e instanceof ApiError && e.status === 409) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const rating = (field: "importance" | "conviction", labels: string[], legend: string) => (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{legend}</span>
      <select
        value={belief[field] ?? ""}
        disabled={busy}
        onChange={(e) =>
          void save({ [field]: e.target.value ? Number(e.target.value) : null }, "rated")
        }
        className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
      >
        <option value="">Not set</option>
        {labels.map((label, i) => (
          <option key={label} value={i + 1}>
            {i + 1} · {label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <li className="rounded-md border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
      {belief.topic && (
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {belief.topic}
        </p>
      )}

      {editing ? (
        <form
          className="mt-2 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ position, nuance: nuance.trim() || null }, "edited");
          }}
        >
          <div>
            <label htmlFor={ids.position} className="block font-medium">
              Your belief, in your words
            </label>
            <textarea
              id={ids.position}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              maxLength={300}
              required
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-950"
            />
          </div>
          <div>
            <label htmlFor={ids.nuance} className="block font-medium">
              Any condition or nuance? (optional)
            </label>
            <textarea
              id={ids.nuance}
              value={nuance}
              onChange={(e) => setNuance(e.target.value)}
              maxLength={1000}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-950"
            />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Saving your wording confirms it.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !position.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save and confirm"}
            </button>
            <button
              type="button"
              disabled={busy}
              className={button}
              onClick={() => {
                setEditing(false);
                setPosition(belief.position);
                setNuance(belief.nuance ?? "");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p id={`belief-${belief.id}`} className="mt-1 text-base font-medium">
            {belief.position}
          </p>
          {belief.nuance && (
            <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
              {belief.nuance}
            </p>
          )}
        </>
      )}

      {belief.source && (
        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          <p>From your answer to: {belief.source.prompt}</p>
          {belief.source.explanation && (
            <p className="mt-0.5 whitespace-pre-wrap">You wrote: “{belief.source.explanation}”</p>
          )}
        </div>
      )}

      {belief.sourceChanged && (
        <p className="mt-2 rounded-md bg-amber-100 p-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          You&apos;ve changed the answer this came from. It stays as you confirmed it; keep it,
          reword it or reject it.{" "}
          {belief.source && (
            <Link
              href={`/discovery/guided?edit=${belief.source.questionId}`}
              className="font-medium underline"
            >
              See the answer
            </Link>
          )}
        </p>
      )}

      {belief.status === "CONFIRMED" && !editing && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {rating("importance", IMPORTANCE, "Importance")}
          {rating("conviction", CONVICTION, "How sure you are")}
        </div>
      )}

      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {belief.status !== "CONFIRMED" && (
            <button
              type="button"
              disabled={busy}
              {...describedBy}
              onClick={() => void save({ status: "CONFIRMED" }, "confirmed")}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
            >
              {belief.status === "REJECTED" ? "Confirm instead" : "Confirm"}
            </button>
          )}
          {belief.status !== "REJECTED" && (
            <button
              type="button"
              disabled={busy}
              {...describedBy}
              onClick={() => setEditing(true)}
              className={button}
            >
              Edit wording
            </button>
          )}
          {belief.status !== "REJECTED" && (
            <button
              type="button"
              disabled={busy}
              {...describedBy}
              onClick={() => void save({ status: "REJECTED" }, "rejected")}
              className={button}
            >
              Doesn&apos;t fit me
            </button>
          )}
        </div>
      )}

      <p role="alert" className="mt-2 text-sm text-amber-800 empty:hidden dark:text-amber-300">
        {error}
      </p>
    </li>
  );
}
