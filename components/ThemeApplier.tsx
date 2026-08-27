"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

export function ThemeApplier() {
  const locale = useLocale();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (stored === "dark" || (stored === null && prefersDark)) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {}
  }, [locale]);

  return null;
}
