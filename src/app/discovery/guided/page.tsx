import { redirect } from "next/navigation";
import { AnswerHistory } from "@/components/discovery/AnswerHistory";
import { DeleteSessionButton } from "@/components/discovery/DeleteSessionButton";
import { GuidedDiscovery } from "@/components/discovery/GuidedDiscovery";
import { ModeSwitchButton } from "@/components/discovery/ModeSwitchButton";
import { listGuidedAnswers } from "@/domain/responses/response-service";
import { getPageSession } from "@/lib/page-session";

export const dynamic = "force-dynamic";

export default async function GuidedPage() {
  const resolved = await getPageSession();
  if (resolved.status === "expired") redirect("/?expired=1");
  if (resolved.status === "none") redirect("/");

  const answers = await listGuidedAnswers(resolved.session.id);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Guide Me</h1>
        <ModeSwitchButton to="CONVERSATION" label="Switch to Let's Talk" />
      </div>
      <GuidedDiscovery />
      <AnswerHistory answers={answers} />
      <div className="mt-10 border-t border-slate-200 pt-4 dark:border-slate-800">
        <DeleteSessionButton />
      </div>
    </div>
  );
}
