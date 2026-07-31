const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="18" fill="#171b16"/>
  <path d="M32 49C21 42 13 35 13 25c0-7 5-12 12-12 4 0 7 2 9 5 2-3 5-5 9-5 7 0 12 5 12 12 0 10-9 18-23 24Z" fill="#c9f33e"/>
</svg>`;

export async function GET() {
  return new Response(icon, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
