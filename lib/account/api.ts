import { NextResponse } from "next/server"
import { z } from "zod"
import { getBasePath } from "@/lib/base-path"
import type { ChatSession } from "@/lib/session-storage"
import { getAccountDb, isAccountMode } from "./db"
import { AccountError } from "./errors"
import { findUserBySessionToken } from "./store"
import type { AccountUser } from "./types"

export const SESSION_COOKIE = "next_ai_drawio_session"
const SESSION_MAX_AGE = 7 * 24 * 60 * 60

export function getSessionToken(req: Request): string | null {
    const cookie = req.headers.get("cookie") ?? ""
    for (const part of cookie.split(";")) {
        const [name, ...rest] = part.trim().split("=")
        if (name === SESSION_COOKIE) return rest.join("=") || null
    }
    return null
}

export function optionalAccountUser(req: Request): AccountUser | null {
    if (!isAccountMode()) return null
    getAccountDb()
    const token = getSessionToken(req)
    return token ? findUserBySessionToken(token) : null
}

export function requireAccountUser(req: Request): AccountUser {
    if (!isAccountMode()) {
        throw new AccountError("Account mode is disabled", 404, "disabled")
    }
    const user = optionalAccountUser(req)
    if (!user) throw new AccountError("Unauthorized", 401, "unauthorized")
    return user
}

export function sessionCookieOptions(req: Request) {
    const forwardedProto = req.headers.get("x-forwarded-proto")
    const secure =
        forwardedProto === "https" || new URL(req.url).protocol === "https:"
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure,
        path: getBasePath() || "/",
        maxAge: SESSION_MAX_AGE,
    }
}

export function jsonWithSession(
    body: unknown,
    token: string,
    req: Request,
): NextResponse {
    const response = NextResponse.json(body)
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req))
    return response
}

export async function readJsonBody(
    req: Request,
    maxBytes: number,
): Promise<unknown> {
    const contentLength = Number(req.headers.get("content-length") ?? 0)
    if (contentLength > maxBytes) {
        throw new AccountError("Request body too large", 413, "body_too_large")
    }
    if (!req.body) return {}
    const reader = req.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
            await reader.cancel()
            throw new AccountError(
                "Request body too large",
                413,
                "body_too_large",
            )
        }
        chunks.push(value)
    }
    try {
        return JSON.parse(
            Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString(
                "utf8",
            ),
        )
    } catch {
        throw new AccountError("Invalid JSON body", 400, "invalid_json")
    }
}

const messageSchema = z.object({
    id: z.string().min(1).max(200),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.object({ type: z.string().min(1) }).passthrough()),
    metadata: z.unknown().optional(),
})

export const sessionPayloadSchema = z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    title: z.string().max(100),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    messages: z.array(messageSchema).max(2000),
    xmlSnapshots: z.array(
        z.tuple([z.number().int().nonnegative(), z.string()]),
    ),
    diagramXml: z.string().max(8 * 1024 * 1024),
    thumbnailDataUrl: z
        .string()
        .max(5 * 1024 * 1024)
        .optional(),
    versions: z.array(z.unknown()).max(20).optional(),
})

export function parseSessionPayload(value: unknown): ChatSession {
    const result = sessionPayloadSchema.safeParse(value)
    if (!result.success) {
        throw new AccountError(
            "Invalid document payload",
            400,
            "invalid_payload",
        )
    }
    return result.data as ChatSession
}
