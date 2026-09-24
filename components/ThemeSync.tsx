"use client";

// Re-applies the theme on client-side navigation (the <head> script only runs on
// full page loads): leaving the dashboard for a public page switches back to
// light, entering it restores the user's choice. See utils/theme.ts.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyTheme } from "@/utils/theme";

export default function ThemeSync() {
  const pathname = usePathname();
  useEffect(() => { applyTheme(pathname); }, [pathname]);
  return null;
}
