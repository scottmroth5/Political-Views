import { redirect } from "next/navigation";
import { DeleteSessionButton } from "@/components/discovery/DeleteSessionButton";
import { ModeSwitchButton } from "@/components/discovery/ModeSwitchButton";
import { getPageSession } from "@/lib/page-session";

export const dynamic = "force-dynamic";

/** Placeholder: open conversation ships in Milestone 3. Nothing here is simulated. */
export default async function ConversationPage() {
  const resolved = await getPageSession();
  if (resolved.status === "expired") redirect("/?expired=1");
  if (resolved.status === "none") redirect("/");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Let&apos;s Talk</h1>
      <div className="rounded-lg border border-dashed border-slate-400 bg-white p-5 dark:border-slate-600 dark:bg-slate-900">
        <p className="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-700">
          Not available yet
        </p>
        <h2 className="mt-2 text-lg font-semibold">Open conversation is still being built</h2>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          Soon you&apos;ll be able to describe your views in your own words and review what we
          understood before anything is saved as a belief. Your session is active, and anything you
          answer in Guide Me is kept when you switch modes.
        </p>
        <div className="mt-4">
          <ModeSwitchButton to="GUIDED" label="Switch to Guide Me" />
        </div>
      </div>
      <DeleteSessionButton />
    </div>
  );
}
