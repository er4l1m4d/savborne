import type { Metadata, Viewport } from "next";
import type { PropsWithChildren } from "react";
import { Plus_Jakarta_Sans, Silkscreen } from "next/font/google";
import { VersionGate } from "@/components/VersionGate";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
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
        <VersionGate>{children}</VersionGate>
      </body>
    </html>
  );
}
