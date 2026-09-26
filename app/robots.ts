import type { MetadataRoute } from "next";
import { SEO_BASE_URL } from "@/utils/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/track/", "/*/p/", "/*/dashboard", "/*/admin", "/*/auth/"],
      },
    ],
    sitemap: `${SEO_BASE_URL}/sitemap.xml`,
    host: SEO_BASE_URL,
  };
}
