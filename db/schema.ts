export const createAssetsTableSql = `
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    object_key TEXT,
    source_url TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    mime_type TEXT,
    created_at TEXT NOT NULL
  )
`;

export const createAssetsDateIndexSql =
  "CREATE INDEX IF NOT EXISTS assets_created_at_idx ON assets(created_at DESC)";
