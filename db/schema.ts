import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const createUsersTableSql = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    picture_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const createUserApiKeysTableSql = `
  CREATE TABLE IF NOT EXISTS user_api_keys (
    user_id TEXT PRIMARY KEY,
    encrypted_key TEXT NOT NULL,
    key_last_four TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

export const createEmailCredentialsTableSql = `
  CREATE TABLE IF NOT EXISTS email_credentials (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    user_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    iterations INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

export const createGenerationTasksTableSql = `
  CREATE TABLE IF NOT EXISTS generation_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

export const createGenerationTasksUserIndexSql =
  "CREATE INDEX IF NOT EXISTS generation_tasks_user_idx ON generation_tasks(user_id, created_at DESC)";

export const createAssetOwnersTableSql = `
  CREATE TABLE IF NOT EXISTS asset_owners (
    asset_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

export const createAssetOwnersUserIndexSql =
  "CREATE INDEX IF NOT EXISTS asset_owners_user_idx ON asset_owners(user_id, created_at DESC)";

export const createConversationsTableSql = `
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

export const createConversationsUserIndexSql =
  "CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations(user_id, updated_at DESC)";

export const createConversationTurnsTableSql = `
  CREATE TABLE IF NOT EXISTS conversation_turns (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

export const createConversationTurnsIndexSql =
  "CREATE INDEX IF NOT EXISTS conversation_turns_idx ON conversation_turns(user_id, conversation_id, created_at ASC)";

export const createAnalyticsEventsTableSql = `
  CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    mode TEXT,
    skill TEXT,
    conversation_id TEXT,
    turn_id TEXT,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

export const createAnalyticsEventsDateIndexSql =
  "CREATE INDEX IF NOT EXISTS analytics_events_date_idx ON analytics_events(created_at DESC)";

export const createAnalyticsEventsUserIndexSql =
  "CREATE INDEX IF NOT EXISTS analytics_events_user_idx ON analytics_events(user_id, created_at DESC)";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  pictureUrl: text("picture_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userApiKeys = sqliteTable("user_api_keys", {
  userId: text("user_id").primaryKey().references(() => users.id, {
    onDelete: "cascade",
  }),
  encryptedKey: text("encrypted_key").notNull(),
  keyLastFour: text("key_last_four").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const emailCredentials = sqliteTable("email_credentials", {
  email: text("email").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id, {
    onDelete: "cascade",
  }),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  iterations: integer("iterations").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const generationTasks = sqliteTable(
  "generation_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("generation_tasks_user_idx").on(table.userId, table.createdAt),
  ],
);

export const assetOwners = sqliteTable(
  "asset_owners",
  {
    assetId: text("asset_id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, {
      onDelete: "cascade",
    }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("asset_owners_user_idx").on(table.userId, table.createdAt),
  ],
);
