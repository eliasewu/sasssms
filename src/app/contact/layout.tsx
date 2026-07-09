import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — Get in Touch with Net2APP",
  description:
    "Contact Net2APP for SMS gateway inquiries, Voice OTP questions, partnership opportunities, and technical support. Reach our team via the contact form or email at info@net2app.com.",
  keywords: [
    "Contact Net2APP", "SMS Gateway Support", "Voice OTP Support",
    "Net2APP Email", "Net2APP Contact", "SMS Platform Support",
    "Technical Support SMS", "SMS Gateway Inquiry",
    "Partnership Net2APP", "Enterprise SMS Contact",
  ],
  openGraph: {
    title: "Contact Net2APP — SMS Gateway & Voice OTP Platform",
    description:
      "Get in touch with the Net2APP team. Send us a message and we'll respond within 24 hours.",
    url: "https://net2app.com/contact",
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
