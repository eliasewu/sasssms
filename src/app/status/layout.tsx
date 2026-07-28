import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Server Status — Net2APP",
  description: "Real-time health status of all Net2APP server locations worldwide. Check which servers are online and which are down.",
  openGraph: {
    title: "Server Status — Net2APP",
    description: "Real-time health status of all Net2APP server locations.",
  },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
