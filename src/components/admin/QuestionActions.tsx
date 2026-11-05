"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

const button =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800";

/** Copy, mark reviewed and archive. There is deliberately no edit or delete. */
export function QuestionActions({
  id,
  status,
  responseCount,
}: {
  id: string;
  status: "draft" | "reviewed" | "archived";
  responseCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const describedBy = { "aria-describedby": `q-${id}` };

  async function run(action: "archive" | "review", confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/questions/${id}/${action}`, { method: "POST" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/questions/new?from=${id}`} className={button} {...describedBy}>
          Copy
        </Link>
        {status === "draft" && (
          <button
            type="button"
            disabled={busy}
            className={button}
            {...describedBy}
            onClick={() =>
              void run(
                "review",
                "Mark this question reviewed? Production will start asking it. This can't be undone (archive it instead).",
              )
            }
          >
            Mark reviewed
          </button>
        )}
        {status !== "archived" && (
          <button
            type="button"
            disabled={busy}
            className={button}
            {...describedBy}
            onClick={() =>
              void run(
                "archive",
                `Archive this question? It will no longer be asked. Its ${responseCount} existing answer(s) are kept. This can't be undone.`,
              )
            }
          >
            Archive
          </button>
        )}
      </div>
      <p role="alert" className="mt-2 text-sm text-amber-800 empty:hidden dark:text-amber-300">
        {error}
      </p>
    </div>
  );
}
