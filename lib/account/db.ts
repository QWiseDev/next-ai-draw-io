import { chmodSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS folders_user ON folders(user_id);
CREATE TABLE IF NOT EXISTS documents (
    id TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    payload TEXT NOT NULL,
    thumbnail TEXT,
    message_count INTEGER NOT NULL DEFAULT 0,
    has_diagram INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS documents_user_updated ON documents(user_id, deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS documents_folder ON documents(folder_id);
PRAGMA user_version = 1;
`

const globalState = globalThis as typeof globalThis & {
    __accountDb?: DatabaseSync
}

export function isAccountMode(): boolean {
    return process.env.ACCOUNT_MODE === "true"
}

export function getAccountDb(): DatabaseSync {
    if (globalState.__accountDb) return globalState.__accountDb
    const dbPath =
        process.env.ACCOUNT_DB_PATH ||
        path.join(process.cwd(), "data", "accounts.db")
    mkdirSync(path.dirname(dbPath), { recursive: true })
    const db = new DatabaseSync(dbPath)
    db.exec("PRAGMA journal_mode = WAL;")
    db.exec("PRAGMA foreign_keys = ON;")
    db.exec(SCHEMA)
    chmodSync(dbPath, 0o600)
    globalState.__accountDb = db
    return db
}

export function resetAccountDbForTests(): void {
    globalState.__accountDb?.close()
    delete globalState.__accountDb
}
