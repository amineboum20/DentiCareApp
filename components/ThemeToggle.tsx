"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "Mode clair" : "Mode sombre"}
      className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
      <span className="text-base">{dark ? "🌙" : "☀️"}</span>
      <span className="flex-1 text-start">{dark ? "Mode sombre" : "Mode clair"}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${dark ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"}`}>
        <span className={`pointer-events-none inline-block h-4 w-4 m-0.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${dark ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
