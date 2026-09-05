"use client";

import { useEffect, useState } from "react";

// Renders a genuine instant (an appointment scheduled_at, or a created_at
// timestamp — both stored in UTC in this app) in the VIEWER'S own local
// timezone. So a cabinet in Morocco sees Morocco time and one in France sees
// France time, with no hardcoded zone.
//
// Timezone conversion can only happen on the client (the server has no idea
// what zone the viewer is in). To stay hydration-safe we format in UTC on the
// server and on the first client render (identical text), then re-render in the
// browser's local zone after mount. suppressHydrationWarning covers the one
// remaining text swap.
export default function LocalInstant({
  iso,
  options = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
  locale = "fr-FR",
}: {
  iso: string | null | undefined;
  options?: Intl.DateTimeFormatOptions;
  locale?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!iso) return <>—</>;

  const text = new Date(iso).toLocaleString(locale, {
    ...options,
    timeZone: mounted ? undefined : "UTC",
  });

  return <span suppressHydrationWarning>{text}</span>;
}
