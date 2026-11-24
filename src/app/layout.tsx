import type { Metadata, Viewport } from "next";
import type { PropsWithChildren } from "react";
import localFont from "next/font/local";
import { VersionGate } from "@/components/VersionGate";
import { siteUrl } from "@/lib/site-url";
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
// production domain; see lib/site-url.ts for why VERCEL_URL is the wrong one.
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
        {/* The app cannot run without scripting: every route needs the wallet
            bridge, and the gate resolves client-side. With scripting off the
            rendered shell would read "Preparing Savborne…" forever, so that
            shell is hidden and this stands in its place. It also gives the
            document real body text for anything that parses without executing
            JS — the served HTML is otherwise a loading screen and nothing else. */}
        <noscript>
          <style>{`.sv-frame{display:none}`}</style>
          <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center gap-6 px-6 py-16">
            <h1 className="sv-subheading-lg text-fg">
              Savborne — a savings RPG for Nimiq Pay
            </h1>
            <p className="sv-body text-fg-muted">
              Keep NIM in a vault only you control, check in daily, and turn the balance that is
              really on chain into XP, streaks, items and rank.
            </p>
            <p className="sv-body text-fg-muted">
              Savborne runs inside Nimiq Pay as a Mini App and needs scripting to reach your wallet.
              Open{" "}
              <a className="text-mint underline" href={siteUrl}>
                savborne.vercel.app
              </a>{" "}
              in Nimiq Pay to start, or read about it at{" "}
              <a className="text-mint underline" href="https://github.com/er4l1m4d/savborne">
                github.com/er4l1m4d/savborne
              </a>
              .
            </p>
            <p className="sv-caption text-fg-faint">
              Non-custodial: Savborne reads the vault on chain and cannot move your NIM.
            </p>
          </main>
        </noscript>
        <div className="sv-frame">
          <VersionGate>{children}</VersionGate>
        </div>
      </body>
    </html>
  );
}
