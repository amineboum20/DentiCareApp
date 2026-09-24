"use client";

// The one error style used across the app: a small red box. Renders nothing
// when there is no message, and scrolls itself into view when it appears so an
// error in a long modal/form is never missed.

import { useEffect, useRef } from "react";

export default function ErrorBanner({ message, className = "" }: { message?: string | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [message]);

  if (!message) return null;
  return (
    <div
      ref={ref}
      role="alert"
      className={`rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400 ${className}`}
    >
      {message}
    </div>
  );
}
