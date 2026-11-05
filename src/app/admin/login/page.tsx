import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { isAdminEnabled, isAdminSession } from "@/domain/admin/admin-session";
import { adminCookieName } from "@/lib/admin-cookie";

export const metadata = { title: "Admin sign-in · Political Views" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (!isAdminEnabled()) notFound();
  const store = await cookies();
  if (await isAdminSession(store.get(adminCookieName())?.value)) redirect("/admin");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Admin sign-in</h1>
      <AdminLoginForm />
    </div>
  );
}
