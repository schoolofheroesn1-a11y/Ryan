import type { Metadata, Viewport } from "next";
import { Caveat, Onest, Unbounded } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], display: "swap" });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin", "cyrillic"], weight: ["500", "600", "700"], display: "swap" });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin", "cyrillic"], weight: ["500", "700"], display: "swap" });

const appUrl = process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Лаборатория педагогических технологий",
    template: "%s — Лаборатория педагогических технологий",
  },
  description:
    "Открытая библиотека практических педагогических решений с понятными инструкциями, ограничениями и статусом проверки. Испытания образовательных технологий по прозрачной методике.",
  openGraph: { type: "website", locale: "ru_RU", siteName: "Лаборатория педагогических технологий" },
};

export const viewport: Viewport = { themeColor: "#f4f6fb" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${onest.variable} ${unbounded.variable} ${caveat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow">
          Перейти к содержанию
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
