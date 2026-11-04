"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function DeleteSessionButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const confirmed = window.confirm(
      "Delete this session and all of your answers? This cannot be undone.",
    );
    if (!confirmed) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch("/api/sessions/current", { method: "DELETE" });
      router.replace("/?deleted=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete. Please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-sm text-slate-700 underline underline-offset-4 hover:text-slate-950 disabled:opacity-60 dark:text-slate-300 dark:hover:text-white"
      >
        {pending ? "Deleting…" : "Delete my session and data"}
      </button>
      <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
        {error}
      </p>
    </div>
  );
}
