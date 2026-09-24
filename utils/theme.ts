// Theme policy (identical in both apps):
//   - public pages (landing, signin, signup, contact, portal…) are ALWAYS light;
//   - signed-in areas (/dashboard, /admin) use the user's choice, light by default.
// The choice is stored locally (localStorage + cookie fallback) and in the
// account (user_metadata.theme) so it follows the user to another browser.
// THEMED_PATH is duplicated as a string in the inline <head> script of
// app/[locale]/layout.tsx (runs before paint) — keep both in sync.

export type Theme = "light" | "dark";

export const THEMED_PATH = /^\/(en|fr|ar)\/(dashboard|admin)(\/|$)/;

export function readThemePref(): Theme {
  let t: string | null | undefined;
  try { t = localStorage.getItem("theme"); } catch {}
  if (t == null) t = (document.cookie.match(/(?:^|;\s*)theme=([^;]*)/) || [])[1];
  return t === "dark" ? "dark" : "light";
}

export function writeThemePref(value: Theme) {
  try { localStorage.setItem("theme", value); } catch {}
  try { document.cookie = `theme=${value};path=/;max-age=31536000;SameSite=Lax`; } catch {}
}

/** Apply the effective theme for a pathname: dark only in signed-in areas. */
export function applyTheme(pathname: string) {
  const dark = THEMED_PATH.test(pathname) && readThemePref() === "dark";
  document.documentElement.classList.toggle("dark", dark);
}
