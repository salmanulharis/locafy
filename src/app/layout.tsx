import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "@/components/feedback/toaster";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Locafy — find products in shops near you", template: "%s · Locafy" },
  description: "Search for a product, compare prices at nearby shops, check availability and get directions.",
  applicationName: "Locafy",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Locafy", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: BRAND.primary,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only z-[100] rounded-lg bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          Skip to content
        </a>
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
