"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { apiFetch, modePath } from "@/lib/api-client";

type Mode = "GUIDED" | "CONVERSATION";

const options: { mode: Mode; title: string; body: string; note?: string }[] = [
  {
    mode: "GUIDED",
    title: "Guide Me",
    body: "Answer one short question at a time across a range of issues. Skip anything, or say you're not sure.",
  },
  {
    mode: "CONVERSATION",
    title: "Let's Talk",
    body: "Describe your views in your own words and confirm what we understood.",
    note: "Coming soon — not available yet",
  },
];

export function StartDiscovery({ hasSession }: { hasSession: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(mode: Mode) {
    setPending(mode);
    setError(null);
    try {
      await apiFetch("/api/sessions", { method: "POST", body: { mode } });
      track("discovery_started", { mode: mode === "GUIDED" ? "guided" : "conversation" });
      router.push(modePath(mode));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start. Please try again.");
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="choose-mode">
      <h2 id="choose-mode" className="text-lg font-semibold">
        {hasSession ? "Or continue in a different way" : "How would you like to start?"}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.mode}
            type="button"
            onClick={() => start(o.mode)}
            disabled={pending !== null}
            className="rounded-lg border border-slate-300 bg-white p-5 text-left shadow-sm transition hover:border-accent disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
          >
            <span className="block text-base font-semibold">{o.title}</span>
            <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{o.body}</span>
            {o.note && (
              <span className="mt-2 inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {o.note}
              </span>
            )}
            {pending === o.mode && <span className="mt-2 block text-sm">Starting…</span>}
          </button>
        ))}
      </div>
      <p role="alert" className="mt-3 text-sm text-amber-800 dark:text-amber-300">
        {error}
      </p>
    </section>
  );
}
