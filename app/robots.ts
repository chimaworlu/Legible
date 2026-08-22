import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://legible.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/auth"],
        disallow: ["/dashboard", "/onboarding", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
