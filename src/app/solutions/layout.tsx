import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solutions — SMS Gateway Use Cases by Industry, Team & Company Size | Net2APP",
  description:
    "Explore Net2APP SMS gateway solutions for every use case: verification, fraud prevention, alerts, marketing, AI agents, IVR, contact centers, and more. Tailored for developers, marketers, product teams, and enterprises across financial services, healthcare, retail, ecommerce, and education.",
  keywords: [
    "SMS solutions", "SMS use cases", "SMS gateway solutions",
    "verification SMS", "fraud prevention SMS", "alerts notifications",
    "appointment reminders", "lead alerts", "mass texting",
    "SMS marketing", "cross-sell upsell", "IVR SMS",
    "contact center SMS", "AI agent SMS", "customer data SMS",
    "developer SMS API", "marketing SMS platform",
    "enterprise SMS gateway", "startup SMS API",
    "healthcare SMS", "financial services SMS",
    "retail SMS", "ecommerce SMS", "education SMS",
    "hospitality SMS", "nonprofit SMS",
  ],
  openGraph: {
    title: "SMS Gateway Solutions by Use Case, Team & Industry | Net2APP",
    description:
      "Discover how Net2APP's SMS gateway platform solves real business problems — from verification and fraud prevention to marketing, AI agents, and contact centers.",
  },
};

export default function SolutionsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
