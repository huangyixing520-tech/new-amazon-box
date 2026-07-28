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
    title: "Mercato AI | 跨境电商素材创作",
    description: "上传商品图，为不同市场生成电商图片和商品视频。",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Mercato AI | 跨境电商素材创作",
      description: "上传商品图，为不同市场生成电商图片和商品视频。",
      images: [`${origin}/og.png`],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Mercato AI | 跨境电商素材创作",
      description: "上传商品图，为不同市场生成电商图片和商品视频。",
      images: [`${origin}/og.png`],
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
