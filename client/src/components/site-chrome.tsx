"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/layout";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return <>{children}</>;
  return <><SiteHeader />{children}<SiteFooter /></>;
}
