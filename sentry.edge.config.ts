// Sentry — edge runtime init (middleware, edge routes). Loaded from instrumentation.ts.
// Inert unless NEXT_PUBLIC_SENTRY_DSN is set AND we are in production.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
