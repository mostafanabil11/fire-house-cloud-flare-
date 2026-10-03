import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BrowseCartBar } from "@/components/menu/browse-cart-bar";
import { RESTAURANT } from "@/config/restaurant";
import "./globals.css";

const manrope = localFont({ src: "./fonts/Manrope.ttf", variable: "--font-manrope", display: "swap", weight: "200 800" });
const arabic = localFont({ src: "./fonts/NotoSansArabic.ttf", variable: "--font-arabic", display: "swap", weight: "100 900", preload: false });
// next.config.ts refuses a production build without NEXT_PUBLIC_SITE_URL, so
// the localhost fallback only ever applies in development.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3101";
// A small JPEG rather than the hero itself: WhatsApp drops previews whose image
// is much over 300 KB, and the 2 MB hero PNG was well past that.
const socialPreviewImage = "/images/og.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${RESTAURANT.name} — Order Online`,
  description: "Browse the menu, customize your meal, and order directly from the restaurant.",
  openGraph: {
    type: "website",
    siteName: RESTAURANT.name,
    title: `${RESTAURANT.name} — Order Online`,
    description: "Browse the menu, customize your meal, and order directly from the restaurant.",
    images: [
      {
        url: socialPreviewImage,
        width: 1200,
        height: 630,
        alt: "Burgers, crispy chicken and loaded fries",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${RESTAURANT.name} — Order Online`,
    description: "Browse the menu, customize your meal, and order directly from the restaurant.",
    images: [{ url: socialPreviewImage, alt: "Burgers, crispy chicken and loaded fries" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`h-full antialiased ${manrope.variable} ${arabic.variable}`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline focus:outline-2 focus:outline-foreground"
        >
          Skip to main content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <BrowseCartBar />
        </Providers>
      </body>
    </html>
  );
}
