import Link from "next/link";
import { StartDiscovery } from "@/components/onboarding/StartDiscovery";
import { DeleteSessionButton } from "@/components/discovery/DeleteSessionButton";
import { modePath } from "@/lib/api-client";
import { getEnv } from "@/lib/env";
import { getPageSession } from "@/lib/page-session";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const resolved = await getPageSession();
  const active = resolved.status === "active" ? resolved.session : null;
  const expired = resolved.status === "expired" || params.expired === "1";

  return (
    <div className="space-y-8">
      <section aria-labelledby="welcome-heading" className="space-y-3">
        <h1 id="welcome-heading" className="text-3xl font-bold tracking-tight">
          Understand your own political views
        </h1>
        <p className="text-slate-700 dark:text-slate-300">
          Work through issues at your own pace and build a structured picture of what you believe —
          in your words, on your terms. We won&apos;t tell you what to think, recommend candidates,
          or label you with a party.
        </p>
      </section>

      {params.deleted === "1" && (
        <p role="status" className="rounded-md bg-slate-200 p-3 text-sm dark:bg-slate-800">
          Your session and all of its answers were deleted.
        </p>
      )}
      {expired && !active && (
        <p role="status" className="rounded-md bg-slate-200 p-3 text-sm dark:bg-slate-800">
          Your previous session expired, and its answers were deleted. You can start a new one
          below.
        </p>
      )}

      <aside
        aria-labelledby="privacy-heading"
        className="rounded-lg border border-slate-300 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 id="privacy-heading" className="font-semibold">
          Before you start: your privacy
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
          <li>
            No account or email is needed. A private cookie keeps your session on this device.
          </li>
          <li>
            Your answers are stored only to build your profile. They are not used for advertising or
            sold.
          </li>
          <li>
            Anonymous sessions expire after {getEnv().SESSION_TTL_DAYS} days. You can delete yours
            at any time.
          </li>
        </ul>
        <Link href="/privacy" className="mt-2 inline-block underline underline-offset-4">
          Read the full privacy notice
        </Link>
      </aside>

      {active && (
        <section
          aria-labelledby="resume-heading"
          className="rounded-lg border border-accent bg-white p-5 dark:bg-slate-900"
        >
          <h2 id="resume-heading" className="text-lg font-semibold">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            Your answers on this device are saved until{" "}
            {active.expiresAt.toLocaleDateString("en-US", { dateStyle: "long" })}.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link
              href={modePath(active.mode)}
              className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong"
            >
              Continue where you left off
            </Link>
            <DeleteSessionButton />
          </div>
        </section>
      )}

      <StartDiscovery hasSession={active !== null} />
    </div>
  );
}
