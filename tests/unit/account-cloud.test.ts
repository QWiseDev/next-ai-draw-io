import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

type AccountStore = typeof import("@/lib/account/store")

interface ChatSessionFixture {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messages: []
    xmlSnapshots: []
    diagramXml: string
}

function session(id: string, title = id): ChatSessionFixture {
    return {
        id,
        title,
        createdAt: 1000,
        updatedAt: 2000,
        messages: [],
        xmlSnapshots: [],
        diagramXml: "<mxfile/>",
    }
}

let tempDir: string | null = null
let _store: AccountStore
let accountModules: {
    db: typeof import("@/lib/account/db")
    store: AccountStore
} | null = null

async function setupAccount(): Promise<AccountStore> {
    vi.stubEnv("ACCOUNT_MODE", "true")
    tempDir = mkdtempSync(path.join(tmpdir(), "next-ai-drawio-account-"))
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

describe("cloud account storage", () => {
    it("isolates documents by account", async () => {
        const accountStore = await setupAccount()
        const first = accountStore.createUser("first-user", "hash")
        const second = accountStore.createUser("second-user", "hash")
        accountStore.createDocument(first.id, session("doc-1"))

        expect(accountStore.listDocuments(first.id, "all")).toHaveLength(1)
        expect(accountStore.listDocuments(second.id, "all")).toHaveLength(0)
        expect(accountStore.getDocument(first.id, "doc-1")?.session.title).toBe(
            "doc-1",
        )
        expect(accountStore.getDocument(second.id, "doc-1")).toBeNull()
    })

    it("detects concurrent document updates by revision", async () => {
        const accountStore = await setupAccount()
        const user = accountStore.createUser("revision-user", "hash")
        accountStore.createDocument(user.id, session("doc-1"))

        expect(
            accountStore.updateDocumentPayload(
                user.id,
                "doc-1",
                { ...session("doc-1"), title: "second" },
                1,
            ),
        ).toEqual({ revision: 2 })
        expect(() =>
            accountStore.updateDocumentPayload(
                user.id,
                "doc-1",
                { ...session("doc-1"), title: "stale" },
                1,
            ),
        ).toThrowError(/updated elsewhere/)
    })

    it("trashes, restores and permanently deletes documents", async () => {
        const accountStore = await setupAccount()
        const user = accountStore.createUser("trash-user", "hash")
        accountStore.createDocument(user.id, session("doc-1"))

        accountStore.patchDocument(user.id, "doc-1", {
            trash: true,
            expectedRevision: 1,
        })
        expect(accountStore.listDocuments(user.id, "all")).toHaveLength(0)
        expect(accountStore.listDocuments(user.id, "trash")).toHaveLength(1)

        accountStore.patchDocument(user.id, "doc-1", {
            trash: false,
            expectedRevision: 2,
        })
        expect(accountStore.listDocuments(user.id, "all")).toHaveLength(1)

        accountStore.patchDocument(user.id, "doc-1", {
            trash: true,
            expectedRevision: 3,
        })
        accountStore.purgeDocument(user.id, "doc-1")
        expect(accountStore.listDocuments(user.id, "trash")).toHaveLength(0)
        expect(accountStore.getDocument(user.id, "doc-1")).toBeNull()
    })

    it("logs in through the API and exposes the account context", async () => {
        vi.stubEnv("ADMIN_PASSWORD", "admin-password-123")
        const accountStore = await setupAccount()
        const password = await import("@/lib/account/password")
        const correctPassword = "correct-password"
        accountStore.createUser(
            "api-user",
            await password.hashPassword(correctPassword),
        )
        const loginRoute = await import("@/app/api/auth/login/route")
        const configRoute = await import("@/app/api/account/config/route")

        const loginResponse = await loginRoute.POST(
            new Request("http://localhost/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: "api-user",
                    password: correctPassword,
                }),
            }),
        )
        expect(loginResponse.status).toBe(200)
        const setCookie = loginResponse.headers.get("set-cookie") ?? ""
        const token = setCookie
            .split(";")
            .find((part) => part.trim().startsWith("next_ai_drawio_session="))
            ?.split("=")[1]
        expect(token).toBeTruthy()

        const configResponse = await configRoute.GET(
            new Request("http://localhost/api/account/config", {
                headers: { Cookie: `next_ai_drawio_session=${token}` },
            }),
        )
        expect(await configResponse.json()).toMatchObject({
            enabled: true,
            user: { username: "api-user" },
        })
    })
})
