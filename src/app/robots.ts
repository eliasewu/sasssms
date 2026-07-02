import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/super/", "/admin/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/super/"],
      },
      {
        userAgent: "Googlebot-Image",
        allow: "/",
      },
      {
        userAgent: "Googlebot-News",
        allow: "/",
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/super/"],
      },
      {
        userAgent: "BingPreview",
        allow: "/",
      },
      {
        userAgent: "DuckDuckBot",
        allow: "/",
        disallow: ["/api/"],
      },
      {
        userAgent: "Baiduspider",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/super/"],
      },
      {
        userAgent: "YandexBot",
        allow: "/",
        disallow: ["/api/"],
      },
      {
        userAgent: "Slurp",
        allow: "/",
      },
      {
        userAgent: "Twitterbot",
        allow: "/",
      },
      {
        userAgent: "facebookexternalhit",
        allow: "/",
      },
      {
        userAgent: "LinkedInBot",
        allow: "/",
      },
    ],
    sitemap: [
      "https://net2app.com/sitemap.xml",
    ],
    host: "https://net2app.com",
  };
}
