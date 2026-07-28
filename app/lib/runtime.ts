export type PreparedStatement = {
  bind: (...values: unknown[]) => PreparedStatement;
  run: () => Promise<unknown>;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results?: T[] }>;
};

export type D1Binding = {
  prepare: (sql: string) => PreparedStatement;
  batch: (statements: PreparedStatement[]) => Promise<unknown>;
};

export type R2Object = {
  body: BodyInit;
  httpMetadata?: { contentType?: string };
};

export type R2Binding = {
  put: (
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
  get: (key: string) => Promise<R2Object | null>;
};

export type RuntimeBindings = {
  DB?: D1Binding;
  GENERATED_ASSETS?: R2Binding;
};

export async function runtimeBindings(): Promise<RuntimeBindings> {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env as unknown as RuntimeBindings;
  } catch {
    return {};
  }
}
