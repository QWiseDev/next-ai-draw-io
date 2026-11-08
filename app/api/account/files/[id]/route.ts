import { z } from "zod"
import { rejectCrossSite } from "@/lib/access-code"
import {
    parseSessionPayload,
    readJsonBody,
    requireAccountUser,
} from "@/lib/account/api"
import { AccountError, accountErrorResponse } from "@/lib/account/errors"
import {
    getDocument,
    patchDocument,
    purgeDocument,
    updateDocumentPayload,
} from "@/lib/account/store"

export const runtime = "nodejs"
export const maxDuration = 30

const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024

const updateSchema = z.object({
    payload: z.unknown(),
    expectedRevision: z.number().int().positive(),
})

const patchSchema = z.object({
    title: z.string().trim().min(1).max(100).optional(),
    folderId: z.string().min(1).max(64).nullable().optional(),
    trash: z.boolean().optional(),
    expectedRevision: z.number().int().positive(),
})

async function documentId(params: Promise<{ id: string }>): Promise<string> {
    const { id } = await params
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
        throw new AccountError("Invalid document id", 400, "invalid_id")
    }
    return id
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    try {
        const user = requireAccountUser(req)
        const file = getDocument(user.id, await documentId(params))
        if (!file)
            throw new AccountError("Document not found", 404, "not_found")
        return Response.json({ file })
    } catch (error) {
        return accountErrorResponse(error)
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    try {
        const user = requireAccountUser(req)
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const id = await documentId(params)
        const body = updateSchema.safeParse(
            await readJsonBody(req, MAX_DOCUMENT_BYTES),
        )
        if (!body.success) {
            throw new AccountError("Invalid save request", 400, "invalid_input")
        }
        const session = parseSessionPayload(body.data.payload)
        return Response.json(
            updateDocumentPayload(
                user.id,
                id,
                session,
                body.data.expectedRevision,
            ),
        )
    } catch (error) {
        return accountErrorResponse(error)
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    try {
        const user = requireAccountUser(req)
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const id = await documentId(params)
        const body = patchSchema.safeParse(await readJsonBody(req, 64 * 1024))
        if (!body.success) {
            throw new AccountError(
                "Invalid update request",
                400,
                "invalid_input",
            )
        }
        return Response.json(patchDocument(user.id, id, body.data))
    } catch (error) {
        return accountErrorResponse(error)
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    try {
        const user = requireAccountUser(req)
        const id = await documentId(params)
        if (new URL(req.url).searchParams.get("permanent") === "true") {
            purgeDocument(user.id, id)
            return new Response(null, { status: 204 })
        }
        const file = getDocument(user.id, id)
        if (!file)
            throw new AccountError("Document not found", 404, "not_found")
        if (file.deletedAt === null) {
            patchDocument(user.id, id, {
                trash: true,
                expectedRevision: file.revision,
            })
        }
        return new Response(null, { status: 204 })
    } catch (error) {
        return accountErrorResponse(error)
    }
}
