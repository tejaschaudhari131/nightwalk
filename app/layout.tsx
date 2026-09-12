import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NightWalk — Part of the way together",
  description: "Find a walking companion and confirm your own arrival.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
