import { z } from "zod"
import { rejectCrossSite } from "@/lib/access-code"
import {
    parseSessionPayload,
    readJsonBody,
    requireAccountUser,
} from "@/lib/account/api"
import { AccountError, accountErrorResponse } from "@/lib/account/errors"
import { createDocument, listDocuments } from "@/lib/account/store"

export const runtime = "nodejs"
export const maxDuration = 30

const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024

const createSchema = z.object({
    payload: z.unknown(),
    folderId: z.string().min(1).max(64).nullable().optional(),
})

export async function GET(req: Request): Promise<Response> {
    try {
        const user = requireAccountUser(req)
        const url = new URL(req.url)
        const viewParam = url.searchParams.get("view") ?? "all"
        if (!["recent", "all", "trash"].includes(viewParam)) {
            throw new AccountError("Invalid view", 400, "invalid_view")
        }
        const folderParam = url.searchParams.get("folder")
        const folderId =
            folderParam === null
                ? undefined
                : folderParam === "root"
                  ? null
                  : folderParam
        return Response.json({
            files: listDocuments(
                user.id,
                viewParam as "recent" | "all" | "trash",
                folderId,
            ),
        })
    } catch (error) {
        return accountErrorResponse(error)
    }
}

export async function POST(req: Request): Promise<Response> {
    try {
        const user = requireAccountUser(req)
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const body = createSchema.safeParse(
            await readJsonBody(req, MAX_DOCUMENT_BYTES),
        )
        if (!body.success) {
            throw new AccountError(
                "Invalid create request",
                400,
                "invalid_input",
            )
        }
        const session = parseSessionPayload(body.data.payload)
        const created = createDocument(
            user.id,
            session,
            body.data.folderId ?? null,
        )
        return Response.json(created, { status: 201 })
    } catch (error) {
        return accountErrorResponse(error)
    }
}
