import { z } from "zod"
import { rejectCrossSite } from "@/lib/access-code"
import { readJsonBody, requireAccountUser } from "@/lib/account/api"
import { AccountError, accountErrorResponse } from "@/lib/account/errors"
import { createFolder, listFolders } from "@/lib/account/store"

export const runtime = "nodejs"

const folderSchema = z.object({
    name: z.string().trim().min(1).max(60),
})

export async function GET(req: Request): Promise<Response> {
    try {
        const user = requireAccountUser(req)
        return Response.json({ folders: listFolders(user.id) })
    } catch (error) {
        return accountErrorResponse(error)
    }
}

export async function POST(req: Request): Promise<Response> {
    try {
        const user = requireAccountUser(req)
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const body = folderSchema.safeParse(await readJsonBody(req, 4096))
        if (!body.success) {
            throw new AccountError("Invalid folder name", 400, "invalid_input")
        }
        return Response.json(
            { folder: createFolder(user.id, body.data.name) },
            { status: 201 },
        )
    } catch (error) {
        return accountErrorResponse(error)
    }
}
