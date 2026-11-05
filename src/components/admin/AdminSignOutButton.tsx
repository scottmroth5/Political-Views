"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export function AdminSignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await apiFetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
        router.replace("/admin/login");
        router.refresh();
      }}
      className="text-sm font-medium underline underline-offset-4"
    >
      Sign out
    </button>
  );
}
