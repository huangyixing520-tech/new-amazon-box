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
  delete?: (key: string) => Promise<unknown>;
  cleanupUnreferencedGenerated?: (
    referencedKeys: ReadonlySet<string>,
  ) => Promise<{ deletedObjects: number; freedBytes: number }>;
};

export type RuntimeBindings = {
  DB?: D1Binding;
  GENERATED_ASSETS?: R2Binding;
};

type SqliteStatement = {
  run: (...values: unknown[]) => unknown;
  get: (...values: unknown[]) => unknown;
  all: (...values: unknown[]) => unknown[];
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
};

type NodeFs = {
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<unknown>;
  readFile: (path: string, encoding?: "utf8") => Promise<Uint8Array | string>;
  writeFile: (
    path: string,
    value: ArrayBuffer | ArrayBufferView | string,
  ) => Promise<unknown>;
  readdir: (
    path: string,
    options: { withFileTypes: true },
  ) => Promise<Array<{ name: string; isDirectory: () => boolean }>>;
  rm: (path: string, options?: { force?: boolean }) => Promise<void>;
  stat: (path: string) => Promise<{ size: number }>;
};

type NodePath = {
  dirname: (path: string) => string;
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
  sep: string;
};

let nodeBindingsPromise: Promise<RuntimeBindings> | undefined;

function sqliteValue(value: unknown) {
  if (value === undefined) return null;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}

function nodePreparedStatement(
  database: SqliteDatabase,
  sql: string,
): PreparedStatement {
  let values: unknown[] = [];
  const prepared: PreparedStatement = {
    bind: (...nextValues) => {
      values = nextValues.map(sqliteValue);
      return prepared;
    },
    run: async () => database.prepare(sql).run(...values),
    first: async <T>() =>
      (database.prepare(sql).get(...values) as T | undefined) ?? null,
    all: async <T>() => ({
      results: database.prepare(sql).all(...values) as T[],
    }),
  };
  return prepared;
}

function safeObjectPath(path: NodePath, root: string, key: string) {
  const segments = key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment).replaceAll(".", "%2E"));
  return path.join(root, ...segments);
}

function objectKeyFromPath(path: NodePath, root: string, objectPath: string) {
  return path.relative(root, objectPath)
    .split(path.sep)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

async function createNodeBindings(): Promise<RuntimeBindings> {
  const sqliteSpecifier = "node:sqlite";
  const fsSpecifier = "node:fs/promises";
  const pathSpecifier = "node:path";
  const sqlite = await import(/* @vite-ignore */ sqliteSpecifier) as unknown as {
    DatabaseSync: new (path: string) => SqliteDatabase;
  };
  const fs = await import(/* @vite-ignore */ fsSpecifier) as unknown as NodeFs;
  const path = await import(/* @vite-ignore */ pathSpecifier) as unknown as NodePath;
  const dataDirectory = process.env.MERCATO_DATA_DIR?.trim() || ".mercato-data";
  const assetDirectory = path.join(dataDirectory, "assets");
  await fs.mkdir(assetDirectory, { recursive: true });

  const database = new sqlite.DatabaseSync(
    path.join(dataDirectory, "mercato.sqlite"),
  );
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");

  const DB: D1Binding = {
    prepare: (sql) => nodePreparedStatement(database, sql),
    batch: async (statements) => {
      database.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) {
          results.push(await statement.run());
        }
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };

  const GENERATED_ASSETS: R2Binding = {
    put: async (key, value, options) => {
      const objectPath = safeObjectPath(path, assetDirectory, key);
      await fs.mkdir(path.dirname(objectPath), { recursive: true });
      await fs.writeFile(objectPath, new Uint8Array(value));
      await fs.writeFile(
        `${objectPath}.meta.json`,
        JSON.stringify({
          contentType:
            options?.httpMetadata?.contentType || "application/octet-stream",
        }),
      );
    },
    get: async (key) => {
      const objectPath = safeObjectPath(path, assetDirectory, key);
      try {
        const [body, metadataValue] = await Promise.all([
          fs.readFile(objectPath),
          fs.readFile(`${objectPath}.meta.json`, "utf8").catch(() => "{}"),
        ]);
        const metadata = JSON.parse(String(metadataValue)) as {
          contentType?: string;
        };
        return {
          body: body as Uint8Array,
          httpMetadata: { contentType: metadata.contentType },
        };
      } catch {
        return null;
      }
    },
    delete: async (key) => {
      const objectPath = safeObjectPath(path, assetDirectory, key);
      await Promise.all([
        fs.rm(objectPath, { force: true }),
        fs.rm(`${objectPath}.meta.json`, { force: true }),
      ]);
    },
    cleanupUnreferencedGenerated: async (referencedKeys) => {
      const generatedDirectory = path.join(assetDirectory, "generated");
      let deletedObjects = 0;
      let freedBytes = 0;

      async function visit(directory: string) {
        let entries: Awaited<ReturnType<NodeFs["readdir"]>>;
        try {
          entries = await fs.readdir(directory, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const entryPath = path.join(directory, entry.name);
          if (entry.isDirectory()) {
            await visit(entryPath);
            continue;
          }
          if (entry.name.endsWith(".meta.json")) continue;
          const key = objectKeyFromPath(path, assetDirectory, entryPath);
          if (referencedKeys.has(key)) continue;
          const metadataPath = `${entryPath}.meta.json`;
          const [objectSize, metadataSize] = await Promise.all([
            fs.stat(entryPath).then((value) => value.size).catch(() => 0),
            fs.stat(metadataPath).then((value) => value.size).catch(() => 0),
          ]);
          await Promise.all([
            fs.rm(entryPath, { force: true }),
            fs.rm(metadataPath, { force: true }),
          ]);
          deletedObjects += 1;
          freedBytes += objectSize + metadataSize;
        }
      }

      await visit(generatedDirectory);
      return { deletedObjects, freedBytes };
    },
  };

  return { DB, GENERATED_ASSETS };
}

export async function runtimeBindings(): Promise<RuntimeBindings> {
  try {
    const workers = await import("cloudflare:workers");
    const bindings = workers.env as unknown as RuntimeBindings;
    if (bindings.DB && bindings.GENERATED_ASSETS) return bindings;
  } catch {
    // Railway and local production use the Node persistence adapter below.
  }
  nodeBindingsPromise ??= createNodeBindings();
  return nodeBindingsPromise;
}
