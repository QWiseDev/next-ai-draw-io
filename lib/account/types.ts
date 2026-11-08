import type { ChatSession, SessionMetadata } from "@/lib/session-storage"

export interface AccountUser {
    id: number
    username: string
}

export interface AccountConfig {
    enabled: boolean
    user: AccountUser | null
}

export interface AccountFolder {
    id: string
    name: string
    createdAt: number
    updatedAt: number
    fileCount: number
}

export interface CloudDocumentMetadata extends SessionMetadata {
    folderId: string | null
    revision: number
    deletedAt: number | null
}

export interface CloudDocument {
    session: ChatSession
    revision: number
    folderId: string | null
    deletedAt: number | null
}

export interface CloudChatSession extends ChatSession {
    revision?: number
}
