function responseHeaders(source: Response) {
  const headers = new Headers();
  headers.set("content-type", "video/mp4");
  headers.set("cache-control", "public, max-age=86400");
  headers.set("accept-ranges", "bytes");
  const contentLength = source.headers.get("content-length");
  const contentRange = source.headers.get("content-range");
  if (contentLength) headers.set("content-length", contentLength);
  if (contentRange) headers.set("content-range", contentRange);
  return headers;
}

async function demoVideo(request: Request) {
  const videoUrl = new URL("/product-demo.mp4", request.url);
  const range = request.headers.get("range");
  const source = await fetch(videoUrl, {
    headers: range ? { range } : undefined,
  });
  if (!source.ok && source.status !== 206) {
    return Response.json({ error: "演示视频暂时不可用" }, { status: 502 });
  }
  return new Response(source.body, {
    status: source.status,
    headers: responseHeaders(source),
  });
}

export async function GET(request: Request) {
  return demoVideo(request);
}
