import type { Metadata, Viewport } from "next";
import { Golos_Text, Source_Serif_4 } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const golos = Golos_Text({ variable: "--font-golos", subsets: ["latin", "cyrillic"], display: "swap" });
const serif = Source_Serif_4({ variable: "--font-serif-display", subsets: ["latin", "cyrillic"], display: "swap" });

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

export const viewport: Viewport = { themeColor: "#f7f6f2" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${golos.variable} ${serif.variable} h-full antialiased`}>
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
