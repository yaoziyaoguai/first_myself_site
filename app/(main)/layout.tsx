import type { Metadata } from "next";
import "../globals.css";
import { AdminLink } from "@/components/AdminLink";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { SITE_URL, siteDefaults } from "@/content/siteDefaults";

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
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Jinkun Wang 的个人网站",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jinkun Wang · 数据工程与 AI 学习记录",
    description: siteDefaults.identity.bio,
    images: ["/og-image.svg"],
  },
};

export default function MainRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col antialiased">
        <AnalyticsTracker />
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <Navbar />
        <div className="absolute right-4 top-20 z-40 hidden md:block">
          <AdminLink />
        </div>
        <main className="flex-1" id="main-content">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
