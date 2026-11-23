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

// Link previews need absolute image URLs, so the base has to be the canonical
// production domain. VERCEL_URL is the *deployment* URL (savborne-<hash>...),
// which would point every shared card at a frozen build; the project
// production URL is the stable one. NEXT_PUBLIC_SITE_URL wins if a custom
// domain is ever added. The localhost fallback keeps dev quiet instead of
// emitting a build warning.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

const title = "Savborne — Savings RPG for Nimiq Pay";
const description =
  "A non-custodial NIM vault with a game layer. Check in daily and turn your real on-chain balance into XP, streaks, items and rank.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Savborne",
  // public/og.png, built by `node scripts/og-card.mjs`. 1200x630 is the 1.91:1
  // box X, Discord and Telegram crop to, so nothing is letterboxed.
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Savborne",
    title,
    description,
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Savborne: Save for real. Level up for fun. A savings RPG for Nimiq Pay.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
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
