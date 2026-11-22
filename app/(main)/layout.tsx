import type { Metadata } from "next";
import "../globals.css";
import { isAdmin } from "@/lib/auth";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { SITE_URL, siteDefaults } from "@/content/siteDefaults";
import { buildSiteJsonLd, OG_DEFAULT_PATH, serializeJsonLd } from "@/lib/discovery";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Jinkun Wang · 数据工程与 AI 学习记录",
    template: "%s · Jinkun Wang",
  },
  description: siteDefaults.identity.bio,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/rss.xml" },
  },
  openGraph: {
    title: "Jinkun Wang · 数据工程与 AI 学习记录",
    description: siteDefaults.identity.bio,
    type: "website",
    locale: "zh_CN",
    siteName: "Jinkun Wang",
    url: SITE_URL,

  },
  twitter: {
    card: "summary_large_image",
    title: "Jinkun Wang · 数据工程与 AI 学习记录",
    description: siteDefaults.identity.bio,
    images: [OG_DEFAULT_PATH],
  },
};

export default async function MainRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const siteJsonLd = buildSiteJsonLd();
  const admin = await isAdmin();

  return (
    <html data-scroll-behavior="smooth" lang="zh-CN">
      <body className="flex min-h-screen flex-col antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(siteJsonLd) }}
        />
        <AnalyticsTracker />
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <Navbar admin={admin} />
        <main className="flex-1" id="main-content">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
