"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/admin/session", { method: "POST", body: { password } });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-3">
      <div>
        <label htmlFor="admin-password" className="block text-sm font-medium">
          Admin password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-950"
        />
      </div>
      <p role="alert" className="text-sm text-amber-800 empty:hidden dark:text-amber-300">
        {error}
      </p>
      <button
        type="submit"
        disabled={busy || !password}
        className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
