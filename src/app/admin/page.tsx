import Link from "next/link";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { QuestionActions } from "@/components/admin/QuestionActions";
import { listAdminQuestions, type AdminQuestion } from "@/domain/questions/question-admin-service";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = { title: "Admin · Political Views" };
export const dynamic = "force-dynamic";

const FILTERS = {
  current: { label: "Current", match: (q: AdminQuestion) => q.status !== "archived" },
  draft: { label: "Drafts", match: (q: AdminQuestion) => q.status === "draft" },
  reviewed: { label: "Reviewed", match: (q: AdminQuestion) => q.status === "reviewed" },
  archived: { label: "Archived", match: (q: AdminQuestion) => q.status === "archived" },
  all: { label: "All", match: () => true },
} as const;
type Filter = keyof typeof FILTERS;

const STATUS = {
  draft: {
    label: "Draft",
    style: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  reviewed: {
    label: "Reviewed",
    style: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  },
  archived: {
    label: "Archived",
    style: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  },
};

function when(iso: string) {
  const text = new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  return `${text} UTC`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  await requireAdminPage();
  const { show } = await searchParams;
  const filter: Filter = show && show in FILTERS ? (show as Filter) : "current";
  const all = await listAdminQuestions();
  const shown = all.filter(FILTERS[filter].match);
  const count = (s: AdminQuestion["status"]) => all.filter((q) => q.status === s).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Questions</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/questions/new"
            className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong"
          >
            Add a question
          </Link>
          <AdminSignOutButton />
        </div>
      </div>

      <p className="text-sm text-slate-700 dark:text-slate-300">
        {count("reviewed")} reviewed · {count("draft")} drafts · {count("archived")} archived.
        Questions can&apos;t be edited or deleted: to change one, copy it, edit the copy, and
        archive the original. Production asks only reviewed questions. Review checklist:
        docs/editorial-review.md.
      </p>

      <nav aria-label="Filter questions" className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(FILTERS) as Filter[]).map((key) => (
          <Link
            key={key}
            href={key === "current" ? "/admin" : `/admin?show=${key}`}
            aria-current={key === filter ? "page" : undefined}
            className="rounded-md border border-slate-300 px-3 py-1 aria-[current=page]:border-accent aria-[current=page]:font-semibold dark:border-slate-600"
          >
            {FILTERS[key].label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="text-sm">No questions here.</p>
      ) : (
        <ul className="space-y-4">
          {shown.map((q) => (
            <li
              key={q.id}
              className="rounded-md border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 font-medium ${STATUS[q.status].style}`}>
                  {STATUS[q.status].label}
                </span>
                <span className="uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  {q.category.label} · {q.topic.label} ·{" "}
                  {q.responseType === "MULTI_CHOICE" ? "Multi-select" : "Single choice"}
                </span>
              </div>
              <p id={`q-${q.id}`} className="mt-2 text-base font-medium">
                {q.prompt}
              </p>
              <ol className="mt-2 list-decimal space-y-0.5 pl-5">
                {q.choices.map((c) => (
                  <li key={c.value}>
                    {c.label}
                    {c.exclusive && (
                      <span className="text-slate-600 dark:text-slate-400">
                        {" "}
                        (can&apos;t be combined)
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              {q.explanationPrompt && (
                <p className="mt-2 text-slate-600 dark:text-slate-300">
                  Explanation prompt: {q.explanationPrompt}
                </p>
              )}
              <dl className="mt-2 grid gap-x-4 text-xs text-slate-600 sm:grid-cols-2 dark:text-slate-400">
                <div>
                  <dt className="inline">Added: </dt>
                  <dd className="inline">{when(q.createdAt)}</dd>
                </div>
                {q.reviewedAt && (
                  <div>
                    <dt className="inline">Reviewed: </dt>
                    <dd className="inline">{when(q.reviewedAt)}</dd>
                  </div>
                )}
                {q.archivedAt && (
                  <div>
                    <dt className="inline">Archived: </dt>
                    <dd className="inline">{when(q.archivedAt)}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline">Answers: </dt>
                  <dd className="inline">{q.responseCount}</dd>
                </div>
                {q.copiedFrom && (
                  <div className="sm:col-span-2">
                    <dt className="inline">Copied from: </dt>
                    <dd className="inline">{q.copiedFrom.prompt}</dd>
                  </div>
                )}
              </dl>
              <QuestionActions id={q.id} status={q.status} responseCount={q.responseCount} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
