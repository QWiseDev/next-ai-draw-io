import { createHash, randomBytes } from "node:crypto"
import { nanoid } from "nanoid"
import type { ChatSession } from "@/lib/session-storage"
import { getAccountDb } from "./db"
import { AccountError } from "./errors"
import type {
    AccountFolder,
    AccountUser,
    CloudDocument,
    CloudDocumentMetadata,
} from "./types"

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function tokenHash(token: string): string {
    return createHash("sha256").update(token).digest("hex")
}

function userFromRow(row: any): AccountUser {
    return { id: Number(row.id), username: String(row.username) }
}

export function createUser(
    username: string,
    passwordHash: string,
): AccountUser {
    const now = Date.now()
    try {
        const result = getAccountDb()
            .prepare(
                "INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)",
            )
            .run(username, passwordHash, now, now)
        return { id: Number(result.lastInsertRowid), username }
    } catch (error: any) {
        if (String(error?.message).includes("UNIQUE")) {
            throw new AccountError(
                "Username already exists",
                409,
                "duplicate_user",
            )
        }
        throw error
    }
}

export function findUserByUsername(
    username: string,
): (AccountUser & { passwordHash: string }) | null {
    const row = getAccountDb()
        .prepare(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
        )
        .get(username) as any
    return row
        ? { ...userFromRow(row), passwordHash: String(row.password_hash) }
        : null
}

export function createAuthSession(userId: number): {
    token: string
    expiresAt: number
} {
    const token = randomBytes(32).toString("base64url")
    const now = Date.now()
    const expiresAt = now + SESSION_TTL_MS
    getAccountDb()
        .prepare(
            "INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        )
        .run(tokenHash(token), userId, now, expiresAt)
    return { token, expiresAt }
}

export function findUserBySessionToken(token: string): AccountUser | null {
    const row = getAccountDb()
        .prepare(
            `SELECT users.id, users.username FROM auth_sessions
             JOIN users ON users.id = auth_sessions.user_id
             WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?`,
        )
        .get(tokenHash(token), Date.now()) as any
    return row ? userFromRow(row) : null
}

export function deleteAuthSession(token: string): void {
    getAccountDb()
        .prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
        .run(tokenHash(token))
}

function assertFolder(userId: number, folderId: string | null): void {
    if (folderId === null) return
    const row = getAccountDb()
        .prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?")
        .get(folderId, userId)
    if (!row) throw new AccountError("Folder not found", 400, "invalid_folder")
}

export function listFolders(userId: number): AccountFolder[] {
    const rows = getAccountDb()
        .prepare(
            `SELECT folders.id, folders.name, folders.created_at, folders.updated_at,
                    (SELECT COUNT(*) FROM documents
                     WHERE documents.folder_id = folders.id AND documents.deleted_at IS NULL) AS file_count
             FROM folders WHERE folders.user_id = ? ORDER BY folders.name COLLATE NOCASE`,
        )
        .all(userId) as any[]
    return rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        fileCount: Number(row.file_count),
    }))
}

export function createFolder(userId: number, name: string): AccountFolder {
    const now = Date.now()
    const folder = {
        id: nanoid(),
        name,
        createdAt: now,
        updatedAt: now,
        fileCount: 0,
    }
    getAccountDb()
        .prepare(
            "INSERT INTO folders (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(folder.id, userId, folder.name, now, now)
    return folder
}

export function renameFolder(
    userId: number,
    id: string,
    name: string,
): AccountFolder {
    const result = getAccountDb()
        .prepare(
            "UPDATE folders SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        )
        .run(name, Date.now(), id, userId)
    if (Number(result.changes) === 0) {
        throw new AccountError("Folder not found", 404, "not_found")
    }
    const folder = listFolders(userId).find((item) => item.id === id)
    if (!folder) throw new AccountError("Folder not found", 404, "not_found")
    return folder
}

export function deleteFolder(userId: number, id: string): void {
    const db = getAccountDb()
    const folder = db
        .prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?")
        .get(id, userId)
    if (!folder) throw new AccountError("Folder not found", 404, "not_found")
    db.exec("BEGIN")
    try {
        db.prepare(
            "UPDATE documents SET folder_id = NULL WHERE user_id = ? AND folder_id = ?",
        ).run(userId, id)
        db.prepare("DELETE FROM folders WHERE id = ? AND user_id = ?").run(
            id,
            userId,
        )
        db.exec("COMMIT")
    } catch (error) {
        db.exec("ROLLBACK")
        throw error
    }
}

function metadataFromRow(row: any): CloudDocumentMetadata {
    return {
        id: String(row.id),
        title: String(row.title),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        messageCount: Number(row.message_count),
        hasDiagram: Number(row.has_diagram) === 1,
        thumbnailDataUrl: row.thumbnail ? String(row.thumbnail) : undefined,
        folderId: row.folder_id ? String(row.folder_id) : null,
        revision: Number(row.revision),
        deletedAt: row.deleted_at === null ? null : Number(row.deleted_at),
    }
}

export function listDocuments(
    userId: number,
    view: "recent" | "all" | "trash",
    folderId?: string | null,
): CloudDocumentMetadata[] {
    let sql = `SELECT id, title, created_at, updated_at, message_count, has_diagram,
                      thumbnail, folder_id, revision, deleted_at
               FROM documents WHERE user_id = ?`
    const params: Array<string | number> = [userId]
    sql +=
        view === "trash"
            ? " AND deleted_at IS NOT NULL"
            : " AND deleted_at IS NULL"
    if (folderId === null) {
        sql += " AND folder_id IS NULL"
    } else if (typeof folderId === "string") {
        sql += " AND folder_id = ?"
        params.push(folderId)
    }
    sql += " ORDER BY updated_at DESC"
    if (view === "recent") sql += " LIMIT 50"
    const rows = getAccountDb()
        .prepare(sql)
        .all(...params) as any[]
    return rows.map(metadataFromRow)
}

export function getDocument(userId: number, id: string): CloudDocument | null {
    const row = getAccountDb()
        .prepare(
            "SELECT payload, revision, folder_id, deleted_at FROM documents WHERE user_id = ? AND id = ?",
        )
        .get(userId, id) as any
    if (!row) return null
    return {
        session: JSON.parse(String(row.payload)) as ChatSession,
        revision: Number(row.revision),
        folderId: row.folder_id ? String(row.folder_id) : null,
        deletedAt: row.deleted_at === null ? null : Number(row.deleted_at),
    }
}

function documentColumns(session: ChatSession) {
    return {
        title: session.title,
        payload: JSON.stringify(session),
        thumbnail: session.thumbnailDataUrl ?? null,
        messageCount: session.messages.length,
        hasDiagram:
            session.diagramXml && session.diagramXml.trim().length > 0 ? 1 : 0,
    }
}

export function createDocument(
    userId: number,
    session: ChatSession,
    folderId: string | null = null,
): { id: string; revision: number } {
    assertFolder(userId, folderId)
    const columns = documentColumns(session)
    try {
        getAccountDb()
            .prepare(
                `INSERT INTO documents
                 (id, user_id, folder_id, title, payload, thumbnail, message_count, has_diagram, revision, created_at, updated_at, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)`,
            )
            .run(
                session.id,
                userId,
                folderId,
                columns.title,
                columns.payload,
                columns.thumbnail,
                columns.messageCount,
                columns.hasDiagram,
                session.createdAt,
                session.updatedAt,
            )
        return { id: session.id, revision: 1 }
    } catch (error: any) {
        if (String(error?.message).includes("UNIQUE")) {
            throw new AccountError(
                "Document already exists",
                409,
                "duplicate_document",
            )
        }
        throw error
    }
}

export function updateDocumentPayload(
    userId: number,
    id: string,
    session: ChatSession,
    expectedRevision: number,
): { revision: number } {
    const columns = documentColumns({ ...session, id })
    const result = getAccountDb()
        .prepare(
            `UPDATE documents SET title = ?, payload = ?, thumbnail = ?, message_count = ?,
             has_diagram = ?, updated_at = ?, revision = revision + 1
             WHERE user_id = ? AND id = ? AND revision = ? AND deleted_at IS NULL`,
        )
        .run(
            columns.title,
            columns.payload,
            columns.thumbnail,
            columns.messageCount,
            columns.hasDiagram,
            session.updatedAt,
            userId,
            id,
            expectedRevision,
        )
    if (Number(result.changes) === 0) {
        const existing = getDocument(userId, id)
        if (!existing || existing.deletedAt !== null) {
            throw new AccountError("Document not found", 404, "not_found")
        }
        throw new AccountError(
            "Document was updated elsewhere",
            409,
            "revision_conflict",
        )
    }
    return { revision: expectedRevision + 1 }
}

export function patchDocument(
    userId: number,
    id: string,
    patch: {
        title?: string
        folderId?: string | null
        trash?: boolean
        expectedRevision: number
    },
): { revision: number } {
    const existing = getDocument(userId, id)
    if (!existing)
        throw new AccountError("Document not found", 404, "not_found")
    if (existing.revision !== patch.expectedRevision) {
        throw new AccountError(
            "Document was updated elsewhere",
            409,
            "revision_conflict",
        )
    }
    const folderId =
        patch.folderId === undefined ? existing.folderId : patch.folderId
    assertFolder(userId, folderId)
    const now = Date.now()
    const deletedAt =
        patch.trash === undefined
            ? existing.deletedAt
            : patch.trash
              ? now
              : null
    const session = {
        ...existing.session,
        title: patch.title ?? existing.session.title,
        updatedAt: now,
    }
    const columns = documentColumns(session)
    getAccountDb()
        .prepare(
            `UPDATE documents SET folder_id = ?, title = ?, payload = ?, updated_at = ?,
             deleted_at = ?, revision = revision + 1 WHERE user_id = ? AND id = ?`,
        )
        .run(
            folderId,
            columns.title,
            columns.payload,
            now,
            deletedAt,
            userId,
            id,
        )
    return { revision: patch.expectedRevision + 1 }
}

export function purgeDocument(userId: number, id: string): void {
    const result = getAccountDb()
        .prepare(
            "DELETE FROM documents WHERE user_id = ? AND id = ? AND deleted_at IS NOT NULL",
        )
        .run(userId, id)
    if (Number(result.changes) === 0) {
        throw new AccountError("Document not found in trash", 404, "not_found")
    }
}
