import type { MetadataRoute } from "next";

/**
 * robots.txt — search engine + AI crawler policy.
 *
 * AI SEO policy: Net2APP wants visibility in AI answer engines (ChatGPT Search,
 * Perplexity, Google AI Overviews, Bing Copilot, Claude), so both AI *citation*
 * bots and AI *training* bots are allowed on the public site. Private paths
 * (/api/, /dashboard/, /super/, /admin/) remain blocked for everyone.
 *
 * AI content index: https://net2app.com/llms.txt (+ /.well-known/llms.txt)
 * Full AI-readable content: https://net2app.com/llms-full.txt
 */
export default function robots(): MetadataRoute.Robots {
  const PRIVATE = ["/api/", "/dashboard/", "/super/", "/admin/"];
  const PRIVATE_NO_ADMIN = ["/api/", "/dashboard/", "/super/"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE,
      },
      // ── Classic search engines ──
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
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
        disallow: PRIVATE_NO_ADMIN,
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
        disallow: PRIVATE_NO_ADMIN,
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
      {
        userAgent: "Pinterestbot",
        allow: "/",
      },
      {
        userAgent: "Applebot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },

      // ── AI search & citation bots (real-time AI answers — keep allowed) ──
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Perplexity-User",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Claude-SearchBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Claude-User",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Bingbot-News",
        allow: "/",
      },
      {
        userAgent: "DuckAssistBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "YouBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Seekrbot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },

      // ── AI model training / ingestion bots (allowed on public content) ──
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "CCBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Diffbot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "OmgiliBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "KangarooBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "ImagesiftBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Meta-ExternalFetcher",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Anthropic-ai",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Meta-ExternalAgent",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Amazonbot",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Bytespider",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "cohere-ai",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
      {
        userAgent: "Applebot-Extended",
        allow: "/",
        disallow: PRIVATE_NO_ADMIN,
      },
    ],
    sitemap: ["https://net2app.com/sitemap.xml"],
    host: "https://net2app.com",
  };
}
