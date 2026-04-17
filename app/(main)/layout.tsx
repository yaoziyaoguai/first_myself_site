import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "../globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AdminLink } from "@/components/AdminLink";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jinkun Wang | Personal Website",
  description: "个人项目、博客与技术思考，聚焦数据工程、AI 与软件架构。",
  openGraph: {
    title: "Jinkun Wang | Personal Website",
    description: "个人项目、博客与技术思考，聚焦数据工程、AI 与软件架构。",
    type: "website",
    locale: "zh_CN",
    siteName: "Jinkun Wang",
    images: [
      {
        url: "https://wangjinkun333.me/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Jinkun Wang Personal Website",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jinkun Wang | Personal Website",
    description: "个人项目、博客与技术思考，聚焦数据工程、AI 与软件架构。",
    images: ["https://wangjinkun333.me/og-image.svg"],
  },
};

export default function MainRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        style={{ "--font-system-sans": "'SF Pro Rounded', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" } as React.CSSProperties}
        className={`${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <Navbar />
        {/* Admin 入口 - 仅 Admin 用户可见 */}
        <div className="absolute top-16 right-4 z-40 hidden md:block">
          <AdminLink />
        </div>
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
