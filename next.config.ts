import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Ship the (now non-public) workspace file with the route handler that serves it.
  outputFileTracingIncludes: {
    "/[locale]/admin/workspace/raw": ["./content/workspace.html"],
  },
};

export default withNextIntl(nextConfig);
