import { NextResponse } from "next/server";
import { createAssetsTableSql } from "../../../../db/schema";

type PreparedStatement = {
  bind: (...values: unknown[]) => PreparedStatement;
  run: () => Promise<unknown>;
  first: <T>() => Promise<T | null>;
};

type D1Binding = {
  prepare: (sql: string) => PreparedStatement;
};

type R2Object = {
  body: BodyInit;
  httpMetadata?: { contentType?: string };
};

type R2Binding = {
  get: (key: string) => Promise<R2Object | null>;
};

type RuntimeBindings = {
  DB?: D1Binding;
  GENERATED_ASSETS?: R2Binding;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const runtime = await import("cloudflare:workers")
    .then((workers) => workers.env as unknown as RuntimeBindings)
    .catch(() => ({}));
  if (!runtime.DB || !runtime.GENERATED_ASSETS) {
    return NextResponse.json({ error: "资产存储尚未配置" }, { status: 503 });
  }
  await runtime.DB.prepare(createAssetsTableSql).run();
  const { id } = await context.params;
  const asset = await runtime.DB.prepare(
    "SELECT object_key, mime_type FROM assets WHERE id = ?",
  ).bind(id).first<{ object_key: string; mime_type: string | null }>();
  if (!asset) return NextResponse.json({ error: "资产不存在" }, { status: 404 });
  const object = await runtime.GENERATED_ASSETS.get(asset.object_key);
  if (!object) return NextResponse.json({ error: "资产文件不存在" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type":
        object.httpMetadata?.contentType ||
        asset.mime_type ||
        "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
