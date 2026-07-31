const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://mercato-web-production-d504.up.railway.app";

export async function GET() {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /studio",
      "Disallow: /api/",
      `Sitemap: ${siteUrl}/sitemap.xml`,
      "",
    ].join("\n"),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
