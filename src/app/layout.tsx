import type { Metadata, Viewport } from "next";
import type { PropsWithChildren } from "react";
import localFont from "next/font/local";
import { VersionGate } from "@/components/VersionGate";
import "./globals.css";

// Fonts are vendored under ./fonts instead of imported from `next/font/google`.
// See ERRORS.md (2026-11-03) — the Google import fetches stylesheets and woff2
// files at build time, and a Vercel build failed on it with no code change.
// Re-vendor with `npm run fonts:vendor` if a family or weight is added.
const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin-var.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  style: "normal",
  display: "swap",
});

const silkscreen = localFont({
  src: [
    { path: "./fonts/silkscreen-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/silkscreen-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-silkscreen",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base for OG/Twitter image URLs. Vercel provides VERCEL_URL; the
  // localhost fallback keeps dev quiet instead of emitting a build warning.
  metadataBase: new URL(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000",
  ),
  title: "Savborne — Savings RPG for Nimiq Pay",
  description:
    "Connect a NIM savings account. Check in daily. Earn XP, items, badges. Battle other Savborne players.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#152420",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${silkscreen.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="sv-frame">
          <VersionGate>{children}</VersionGate>
        </div>
      </body>
    </html>
  );
}
