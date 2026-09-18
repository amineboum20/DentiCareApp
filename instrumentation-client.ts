// Sentry — browser init. Runs in every visitor's browser.
// Inert unless NEXT_PUBLIC_SENTRY_DSN is set AND we are in production.
// NOTE: Session Replay is intentionally NOT enabled — it would record patient/
// client screens. Do not add the Replay integration without a privacy review.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
