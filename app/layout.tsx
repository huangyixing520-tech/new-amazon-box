import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Mercato AI | 一张图，生成一条 Listing",
    description: "上传商品素材，生成可编辑的 Amazon Listing、商品套图和视频。",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Mercato AI | 一张图，生成一条 Listing",
      description: "上传商品素材，生成可编辑的 Amazon Listing、商品套图和视频。",
      images: [`${origin}/landing-hero.webp`],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Mercato AI | 一张图，生成一条 Listing",
      description: "上传商品素材，生成可编辑的 Amazon Listing、商品套图和视频。",
      images: [`${origin}/landing-hero.webp`],
    },
  };
}

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
