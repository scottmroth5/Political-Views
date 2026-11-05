"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pageFromPath, startAnalytics, track } from "@/lib/analytics";

/** Starts the allowlisted tracker (or turns it off) and records which page was viewed. */
export function AnalyticsBoot({ config }: { config: { host: string; token: string } | null }) {
  const pathname = usePathname();

  useEffect(() => {
    startAnalytics(config);
  }, [config]);

  useEffect(() => {
    track("page_viewed", { page: pageFromPath(pathname) });
  }, [pathname]);

  return null;
}
