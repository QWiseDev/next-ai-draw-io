import { NextResponse } from "next/server"
import { rejectCrossSite } from "@/lib/access-code"
import {
    getSessionToken,
    SESSION_COOKIE,
    sessionCookieOptions,
} from "@/lib/account/api"
import { isAccountMode } from "@/lib/account/db"
import { AccountError, accountErrorResponse } from "@/lib/account/errors"
import { deleteAuthSession } from "@/lib/account/store"

export const runtime = "nodejs"

export async function POST(req: Request): Promise<Response> {
    try {
        if (!isAccountMode()) {
            throw new AccountError("Account mode is disabled", 404, "disabled")
        }
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const token = getSessionToken(req)
        if (token) deleteAuthSession(token)
        const response = NextResponse.json({ ok: true })
        response.cookies.set(SESSION_COOKIE, "", {
            ...sessionCookieOptions(req),
            maxAge: 0,
        })
        return response
    } catch (error) {
        return accountErrorResponse(error)
    }
}
