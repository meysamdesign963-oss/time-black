import type { MetadataRoute } from "next";

/**
 * robots.txt — allow all crawlers, point to sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/admin/", "/settings/", "/login", "/register"],
      },
    ],
    sitemap: "https://timeblack.ir/sitemap.xml",
    host: "https://timeblack.ir",
  };
}
