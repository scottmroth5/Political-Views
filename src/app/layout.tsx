import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsBoot } from "@/components/AnalyticsBoot";
import { getAnalyticsConfig } from "@/lib/analytics-config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Political Views",
  description: "Discover and clarify your own political beliefs, privately and without persuasion.",
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900"
        >
          Skip to content
        </a>
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3"
          >
            <Link href="/" className="font-semibold tracking-tight">
              Political Views
            </Link>
            <Link href="/privacy" className="text-sm underline-offset-4 hover:underline">
              Privacy
            </Link>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-3xl px-4 py-8">
          {children}
        </main>
        <AnalyticsBoot config={getAnalyticsConfig()} />
      </body>
    </html>
  );
}
