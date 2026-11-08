import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

type AccountStore = typeof import("@/lib/account/store")

let tempDir: string | null = null
let accountModules: {
    db: typeof import("@/lib/account/db")
    store: AccountStore
} | null = null

async function setupAccount(): Promise<AccountStore> {
    vi.stubEnv("ACCOUNT_MODE", "true")
    tempDir = mkdtempSync(path.join(tmpdir(), "next-ai-drawio-users-"))
    vi.stubEnv("ACCOUNT_DB_PATH", path.join(tempDir, "accounts.db"))
    const dbModule = await import("@/lib/account/db")
    const storeModule = await import("@/lib/account/store")
    accountModules = { db: dbModule, store: storeModule }
    dbModule.getAccountDb()
    return storeModule
}

function cleanupAccount() {
    accountModules?.db.resetAccountDbForTests()
    accountModules = null
    if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true })
        tempDir = null
    }
    vi.unstubAllEnvs()
}

afterEach(cleanupAccount)

describe("admin user management", () => {
    it("disabling a user rejects login data and revokes sessions", async () => {
        const store = await setupAccount()
        const user = store.createUser("alice", "hash-alice")
        const session = store.createAuthSession(user.id)
        expect(store.findUserBySessionToken(session.token)?.username).toBe(
            "alice",
        )

        store.setUserDisabled(user.id, true)

        expect(store.findUserByUsername("alice")?.disabled).toBe(true)
        expect(store.findUserBySessionToken(session.token)).toBeNull()
        expect(store.findUserById(user.id)?.disabled).toBe(true)
    })

    it("enabling a user restores the active status", async () => {
        const store = await setupAccount()
        const user = store.createUser("bob", "hash-bob")
        store.setUserDisabled(user.id, true)
        store.setUserDisabled(user.id, false)
        expect(store.findUserById(user.id)?.disabled).toBe(false)
    })

    it("resetting the password keeps the user but revokes sessions", async () => {
        const store = await setupAccount()
        const user = store.createUser("carol", "hash-old")
        const session = store.createAuthSession(user.id)

        store.updateUserPassword(user.id, "hash-new")

        expect(store.findUserByUsername("carol")?.passwordHash).toBe("hash-new")
        expect(store.findUserBySessionToken(session.token)).toBeNull()
    })

    it("deleting a user cascades sessions, folders and documents", async () => {
        const store = await setupAccount()
        const user = store.createUser("dave", "hash-dave")
        const session = store.createAuthSession(user.id)
        const folder = store.createFolder(user.id, "work")
        store.createDocument(user.id, emptySession())

        store.deleteUser(user.id)

        expect(store.findUserById(user.id)).toBeNull()
        expect(store.findUserBySessionToken(session.token)).toBeNull()
        expect(store.listFolders(user.id)).toEqual([])
        expect(store.listDocuments(user.id, "all")).toEqual([])
        expect(folder.id).toBeTruthy()
    })

    it("records the last login time", async () => {
        const store = await setupAccount()
        const user = store.createUser("erin", "hash-erin")
        expect(listLastLogin(store, user.id)).toBeNull()
        store.touchLastLogin(user.id)
        expect(listLastLogin(store, user.id)).not.toBeNull()
    })
})

function listLastLogin(store: AccountStore, id: number): number | null {
    return (
        store.listUsersWithStats().find((row) => row.id === id)?.lastLoginAt ??
        null
    )
}

function emptySession(): {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messages: []
    xmlSnapshots: []
    diagramXml: string
} {
    return {
        id: "session-1",
        title: "session-1",
        createdAt: 1000,
        updatedAt: 2000,
        messages: [],
        xmlSnapshots: [],
        diagramXml: "<mxfile/>",
    }
}
