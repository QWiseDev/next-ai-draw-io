import { nanoid } from "nanoid"
import { toast } from "sonner"
import { AccountError } from "@/lib/account/errors"
import type {
    CloudChatSession,
    CloudDocument,
    CloudDocumentMetadata,
} from "@/lib/account/types"
import { accountFetch } from "@/lib/account-client"
import { getAccountTexts } from "@/lib/i18n/account-texts"
import type { ChatSession, SessionMetadata } from "@/lib/session-storage"

let lastSaveError: string | null = null
let conflictRedirecting = false

function texts() {
    return getAccountTexts(
        typeof document === "undefined" ? null : document.documentElement.lang,
    )
}

export function isIndexedDBAvailable(): boolean {
    return true
}

export function getSaveErrorMessage(): string | null {
    const message = lastSaveError
    lastSaveError = null
    return message
}

export async function getAllSessionMetadata(): Promise<SessionMetadata[]> {
    try {
        const { files } = await accountFetch<{
            files: CloudDocumentMetadata[]
        }>("/api/account/files?view=recent")
        return files
    } catch {
        return []
    }
}

export async function getSession(id: string): Promise<ChatSession | null> {
    try {
        const { file } = await accountFetch<{ file: CloudDocument }>(
            `/api/account/files/${encodeURIComponent(id)}`,
        )
        return { ...file.session, revision: file.revision } as CloudChatSession
    } catch (error) {
        if (error instanceof AccountError && error.status === 404) return null
        return null
    }
}

export async function saveSession(session: ChatSession): Promise<boolean> {
    lastSaveError = null
    if (conflictRedirecting) {
        lastSaveError = texts().cloudConflictCopySaved
        return false
    }
    const cloudSession = session as CloudChatSession
    try {
        if (cloudSession.revision === undefined) {
            const created = await accountFetch<{
                id: string
                revision: number
            }>("/api/account/files", {
                method: "POST",
                body: JSON.stringify({ payload: session }),
            })
            cloudSession.revision = created.revision
            return true
        }
        const updated = await accountFetch<{ revision: number }>(
            `/api/account/files/${encodeURIComponent(session.id)}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    payload: session,
                    expectedRevision: cloudSession.revision,
                }),
            },
        )
        cloudSession.revision = updated.revision
        return true
    } catch (error) {
        if (
            error instanceof AccountError &&
            error.status === 409 &&
            cloudSession.revision !== undefined
        ) {
            try {
                const copy: CloudChatSession = {
                    ...session,
                    id: nanoid(),
                    title: `${session.title} ${texts().conflictSuffix}`.slice(
                        0,
                        100,
                    ),
                    updatedAt: Date.now(),
                }
                delete copy.revision
                await accountFetch("/api/account/files", {
                    method: "POST",
                    body: JSON.stringify({ payload: copy }),
                })
                lastSaveError = texts().cloudConflictCopySaved
                conflictRedirecting = true
                const url = new URL(window.location.href)
                url.searchParams.set("session", copy.id)
                setTimeout(() => window.location.assign(url.toString()), 1200)
                return false
            } catch {
                lastSaveError = texts().cloudSaveFailed
                return false
            }
        }
        lastSaveError =
            error instanceof AccountError && error.status === 401
                ? texts().sessionExpired
                : texts().cloudSaveFailed
        return false
    }
}

export async function deleteSession(id: string): Promise<void> {
    try {
        await accountFetch(`/api/account/files/${encodeURIComponent(id)}`, {
            method: "DELETE",
        })
    } catch {
        toast.error(texts().cloudDeleteFailed)
    }
}

export async function readSessionCount(): Promise<number | null> {
    try {
        const { files } = await accountFetch<{
            files: CloudDocumentMetadata[]
        }>("/api/account/files?view=all")
        return files.length
    } catch {
        return null
    }
}

export async function getSessionCount(): Promise<number> {
    return (await readSessionCount()) ?? 0
}

export async function enforceSessionLimit(
    _keep?: () => string | undefined,
): Promise<void> {}

export async function renameSession(
    id: string,
    title: string,
): Promise<ChatSession | null> {
    try {
        const session = await getSession(id)
        if (!session) return null
        const revision = (session as CloudChatSession).revision
        if (revision === undefined) return null
        const updated = await accountFetch<{ revision: number }>(
            `/api/account/files/${encodeURIComponent(id)}`,
            {
                method: "PATCH",
                body: JSON.stringify({ title, expectedRevision: revision }),
            },
        )
        return {
            ...session,
            title,
            updatedAt: Date.now(),
            revision: updated.revision,
        } as CloudChatSession
    } catch {
        lastSaveError = texts().cloudRenameFailed
        return null
    }
}
