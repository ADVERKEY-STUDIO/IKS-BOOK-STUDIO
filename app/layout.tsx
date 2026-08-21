import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IKS Book Studio",
  description: "Adapt any source book into an illustrated book for children aged 7–15.",
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
