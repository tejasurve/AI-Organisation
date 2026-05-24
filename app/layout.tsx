import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Organisation — Live Office",
  description:
    "A living simulation of an autonomous AI startup, driven by real backend execution.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-floor-950 text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
