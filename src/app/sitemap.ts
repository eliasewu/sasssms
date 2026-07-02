import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://net2app.com";
  const lastModified = new Date();

  const mainPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: {
        languages: {
          en: `${baseUrl}/`,
        },
      },
    },
    {
      url: `${baseUrl}/webmail`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  return mainPages;
}
