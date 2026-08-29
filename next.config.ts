import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/docs',   destination: '/workspace.html' },
      { source: '/tests',  destination: '/workspace.html' },
      { source: '/infra',  destination: '/workspace.html' },
    ];
  },
};

export default withNextIntl(nextConfig);
