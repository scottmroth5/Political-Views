import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteSessionButton } from "@/components/discovery/DeleteSessionButton";
import { BeliefCard } from "@/components/profile/BeliefCard";
import { getProfile } from "@/domain/profiles/profile-service";
import { getPageSession } from "@/lib/page-session";

export const metadata = { title: "Your profile · Political Views" };
export const dynamic = "force-dynamic";

const linkClass = "font-medium text-accent-strong underline underline-offset-4 dark:text-teal-300";

/**
 * The preliminary profile (PRD M5): beliefs drawn only from the choices the user picked,
 * confirmed ones kept apart from suggestions, plus the issue areas not covered yet.
 */
export default async function ProfilePage() {
  const resolved = await getPageSession();
  if (resolved.status === "expired") redirect("/?expired=1");
  if (resolved.status === "none") redirect("/");

  const profile = await getProfile(resolved.session.id);
  const withBeliefs = profile.categories.filter((c) => c.confirmed.length + c.suggested.length > 0);
  const remaining = profile.previewThreshold - profile.answeredQuestions;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Your profile</h1>
        <Link href="/discovery/guided" className={linkClass}>
          Keep answering questions
        </Link>
      </div>

      <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <strong>Preliminary and incomplete.</strong> Everything here comes only from the choices you
        picked, worded the way the choice was worded. It is not a label, a score or a party match.
        Confirm what fits you, reword what&apos;s close, and mark what doesn&apos;t fit. Only
        confirmed beliefs count as yours.
      </p>

      {!profile.ready ? (
        <section className="rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Not enough answers for a preview yet</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Answer {remaining} more {remaining === 1 ? "question" : "questions"} (not counting skips
            or &ldquo;not sure&rdquo;) to see your preview.
          </p>
          <Link href="/discovery/guided" className={`mt-3 inline-block ${linkClass}`}>
            Continue with Guide Me
          </Link>
        </section>
      ) : (
        <>
          <section aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="sr-only">
              Summary
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {profile.counts.confirmed} confirmed · {profile.counts.suggested} waiting for review ·{" "}
              {profile.answeredQuestions} questions answered
            </p>
            {profile.counts.needsReview > 0 && (
              <p className="mt-2 rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {profile.counts.needsReview} confirmed{" "}
                {profile.counts.needsReview === 1
                  ? "belief no longer matches"
                  : "beliefs no longer match"}{" "}
                an answer you changed. They are marked below.
              </p>
            )}
          </section>

          {withBeliefs.map((category) => (
            <section
              key={category.slug}
              aria-labelledby={`cat-${category.slug}`}
              className="space-y-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-1 dark:border-slate-800">
                <h2 id={`cat-${category.slug}`} className="text-lg font-semibold">
                  {category.label}
                </h2>
                {category.questionsTotal > 0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {category.questionsAnswered} of {category.questionsTotal} questions answered
                  </p>
                )}
              </div>
              {category.confirmed.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Confirmed
                  </h3>
                  <ul className="space-y-3">
                    {category.confirmed.map((b) => (
                      <BeliefCard key={`${b.id}-${b.version}`} belief={b} />
                    ))}
                  </ul>
                </>
              )}
              {category.suggested.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Suggested from your answers
                  </h3>
                  <ul className="space-y-3">
                    {category.suggested.map((b) => (
                      <BeliefCard key={`${b.id}-${b.version}`} belief={b} />
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))}

          {profile.gaps.length > 0 && (
            <section aria-labelledby="gaps-heading">
              <h2 id="gaps-heading" className="text-lg font-semibold">
                Not covered yet
              </h2>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                You haven&apos;t answered questions in these areas, so your profile says nothing
                about them: {profile.gaps.map((g) => g.label).join(", ")}.
              </p>
            </section>
          )}

          {profile.rejected.length > 0 && (
            <details className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-semibold">
                Marked as not fitting you ({profile.rejected.length})
              </summary>
              <ul className="mt-3 space-y-3">
                {profile.rejected.map((b) => (
                  <BeliefCard key={`${b.id}-${b.version}`} belief={b} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
        <DeleteSessionButton />
      </div>
    </div>
  );
}
