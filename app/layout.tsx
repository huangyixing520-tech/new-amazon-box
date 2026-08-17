import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://mercato-ai-studio-production.up.railway.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Mercato AI | 一张图，生成一条 Listing",
  description: "上传商品素材，生成可编辑的 Amazon Listing、商品套图和视频。",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    url: "/",
    title: "Mercato AI | 一张图，生成一条 Listing",
    description: "上传商品素材，生成可编辑的 Amazon Listing、商品套图和视频。",
    images: ["/og.webp"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mercato AI | 一张图，生成一条 Listing",
    description: "上传商品素材，生成可编辑的 Amazon Listing、商品套图和视频。",
    images: ["/og.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
