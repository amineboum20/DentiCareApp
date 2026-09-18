import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Ship the (now non-public) workspace file with the route handler that serves it.
  outputFileTracingIncludes: {
    "/[locale]/admin/workspace/raw": ["./content/workspace.html"],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Org/project slugs + auth token come from env (set in Vercel + .env.local).
  // If unset, the build simply skips source-map upload — it never fails.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Keep the client bundle lean: drop Sentry's internal debug logger in prod.
  disableLogger: true,
});
