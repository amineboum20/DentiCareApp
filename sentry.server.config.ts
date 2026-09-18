// Sentry — server runtime init. Loaded from instrumentation.ts (register()).
// Inert unless NEXT_PUBLIC_SENTRY_DSN is set AND we are in production.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  // Performance sampling: 10% of transactions in prod.
  tracesSampleRate: 0.1,
  // Patient/client data lives in these apps — never attach PII by default.
  sendDefaultPii: false,
});
