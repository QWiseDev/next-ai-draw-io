import { z } from "zod"
import { rejectCrossSite } from "@/lib/access-code"
import { readJsonBody, requireAccountUser } from "@/lib/account/api"
import { AccountError, accountErrorResponse } from "@/lib/account/errors"
import { deleteFolder, renameFolder } from "@/lib/account/store"

export const runtime = "nodejs"

const patchSchema = z.object({
    name: z.string().trim().min(1).max(60),
})

async function folderId(params: Promise<{ id: string }>): Promise<string> {
    const { id } = await params
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
        throw new AccountError("Invalid folder id", 400, "invalid_id")
    }
    return id
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    try {
        const user = requireAccountUser(req)
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const id = await folderId(params)
        const body = patchSchema.safeParse(await readJsonBody(req, 4096))
        if (!body.success) {
            throw new AccountError("Invalid folder name", 400, "invalid_input")
        }
        return Response.json({
            folder: renameFolder(user.id, id, body.data.name),
        })
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
        deleteFolder(user.id, await folderId(params))
        return new Response(null, { status: 204 })
    } catch (error) {
        return accountErrorResponse(error)
    }
}
