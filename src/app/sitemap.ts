import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://net2app.com";
  const now = new Date();

  return [
    // ── Priority 1.0 — Homepage ──
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: { languages: { en: `${baseUrl}/` } },
    },

    // ── Priority 0.9 — Key Feature Pages ──
    { url: `${baseUrl}/sms-routing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/http-sms-api`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/voice-otp`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },

    // ── Priority 0.8 — Secondary Feature Pages ──
    { url: `${baseUrl}/whatsapp-telegram-api`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/ott-pairing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/ip-whitelisting`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/comparisons`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/case-studies`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },

    // ── Priority 0.7 — Content & Info Pages ──
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/resources`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/api-documentation`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/webmail`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/solutions`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // ── Priority 0.6 — Solutions Overview Pages ──
    { url: `${baseUrl}/solutions/see-all`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/solutions/enterprise`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/solutions/startup`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/solutions/use-cases`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/solutions/teams`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/solutions/industries`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },

    // ── Priority 0.5 — Solutions: Industries ──
    { url: `${baseUrl}/solutions/industries/financial-services`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/industries/healthcare`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/industries/ecommerce`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/industries/retail`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/industries/education`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/industries/hospitality`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/industries/nonprofit`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/industries/public-sector`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },

    // ── Priority 0.5 — Solutions: Teams ──
    { url: `${baseUrl}/solutions/teams/developers`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/teams/data-engineering`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/teams/marketing`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/teams/product`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/teams/customer-experience`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },

    // ── Priority 0.5 — Solutions: Use Cases ──
    { url: `${baseUrl}/solutions/use-cases/verification-and-identity`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/fraud-prevention`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/sms-marketing`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/marketing-and-promotions`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/mass-texting`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/alerts-and-notifications`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/appointment-reminders`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/lead-alerts`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/ai-agent-productivity`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/support-and-sales`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/cross-sell-and-upsell`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/customer-data-management`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/ivr`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/contact-center`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/solutions/use-cases/optimize-ad-spend`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
