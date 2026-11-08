import { optionalAccountUser } from "@/lib/account/api"
import { isAccountMode } from "@/lib/account/db"
import { accountErrorResponse } from "@/lib/account/errors"

export const runtime = "nodejs"

export async function GET(req: Request): Promise<Response> {
    try {
        const enabled = isAccountMode()
        return Response.json({
            enabled,
            user: enabled ? optionalAccountUser(req) : null,
        })
    } catch (error) {
        return accountErrorResponse(error)
    }
}
