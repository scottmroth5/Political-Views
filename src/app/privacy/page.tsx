import { getEnv } from "@/lib/env";

export const metadata = { title: "Privacy · Political Views" };
export const dynamic = "force-dynamic";

/**
 * Data-use disclosure (US-28). DRAFT: must be reviewed by counsel before any
 * public launch. Do not add claims (e.g. AI zero-retention) that are not
 * contractually verified.
 */
export default function PrivacyPage() {
  return (
    <article className="space-y-4 text-slate-800 dark:text-slate-200">
      <h1 className="text-2xl font-bold tracking-tight">Privacy notice</h1>
      <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Draft notice for a pre-release version. It will be reviewed before public launch.
      </p>

      <h2 className="text-lg font-semibold">What we collect</h2>
      <p>
        The answers you give, including any optional explanations and importance ratings, linked to
        an anonymous session. We do not ask for your name or email to get started.
      </p>

      <h2 className="text-lg font-semibold">How your session works</h2>
      <p>
        A random, private cookie identifies your session on this browser. We store only a one-way
        hash of it. If you clear cookies or switch devices or browsers, you won&apos;t be able to
        return to the session. Anonymous sessions expire {getEnv().SESSION_TTL_DAYS} days after they
        start, and their answers are then deleted.
      </p>

      <h2 className="text-lg font-semibold">How we use it</h2>
      <p>
        Only to help you build and review your own political profile. We do not use your answers for
        advertising, persuasion or partisan targeting, and we do not sell them. Your answers are not
        written to analytics tools or application logs.
      </p>

      <h2 className="text-lg font-semibold">Usage counts</h2>
      <p>
        To understand how the site is used, it may count a few events with PostHog (posthog.com,
        United States): which page was opened, that discovery was started, that a question was
        answered, marked &ldquo;not sure&rdquo; or skipped, that the mode was switched, that the
        guided questions were finished, and that a session was deleted. <strong>Never</strong> sent:
        your answers or choices, which question or topic you were on, anything you type, the address
        you came from, or anything that identifies you. No cookie is set for this, and each page
        load gets a new random id, so visits are not linked to each other or to your session.
        PostHog receives your network address with each request, as any website does, and is set not
        to store it. If your browser sends Global Privacy Control or Do Not Track, nothing is sent.
        Blocking it doesn&apos;t change how the site works.
      </p>

      <h2 className="text-lg font-semibold">AI processing</h2>
      <p>
        This version does not send your answers to any AI provider. When AI-assisted features are
        added, this notice will name the provider and describe how it processes and retains data
        before those features are turned on.
      </p>

      <h2 className="text-lg font-semibold">Deleting your data</h2>
      <p>
        Use &ldquo;Delete my session and data&rdquo; on any discovery page to permanently remove
        your session and every answer associated with it. Database backups, once in place, will
        follow a documented retention period.
      </p>
    </article>
  );
}
