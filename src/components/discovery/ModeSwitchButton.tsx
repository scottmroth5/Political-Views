"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, modePath } from "@/lib/api-client";

/** Switches discovery mode server-side; all answers stay with the session (US-03). */
export function ModeSwitchButton({ to, label }: { to: "GUIDED" | "CONVERSATION"; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSwitch() {
    setPending(true);
    setError(null);
    try {
      await apiFetch("/api/sessions/current", { method: "PATCH", body: { mode: to } });
      router.push(modePath(to));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch. Please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onSwitch}
        disabled={pending}
        className="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-strong disabled:opacity-60 dark:text-teal-300"
      >
        {pending ? "Switching…" : label}
      </button>
      <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
        {error}
      </p>
    </div>
  );
}
