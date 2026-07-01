import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Net2APP - Enterprise SMS Gateway Platform",
  description: "Multi-tenant SaaS SMS Gateway with SMPP, HTTP API, RCS, Voice OTP, and more. No setup fees, no hidden fees, pay only for what you use.",
  keywords: "SMS Gateway, SMPP, HTTP API, Voice OTP, RCS, OTT, WhatsApp Business, Multi-tenant, Enterprise SMS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">{children}</body>
    </html>
  );
}
