import { z } from "zod"
import { rejectCrossSite } from "@/lib/access-code"
import { jsonWithSession, readJsonBody } from "@/lib/account/api"
import { isAccountMode } from "@/lib/account/db"
import { AccountError, accountErrorResponse } from "@/lib/account/errors"
import { verifyPassword } from "@/lib/account/password"
import {
    isLoginRateLimited,
    recordLoginFailure,
    resetLoginRate,
} from "@/lib/account/rate-limit"
import {
    createAuthSession,
    findUserByUsername,
    touchLastLogin,
} from "@/lib/account/store"

export const runtime = "nodejs"

const loginSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(32)
        .regex(/^[A-Za-z0-9_.-]+$/)
        .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128),
})

export async function POST(req: Request): Promise<Response> {
    try {
        if (!isAccountMode()) {
            throw new AccountError("Account mode is disabled", 404, "disabled")
        }
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const body = loginSchema.safeParse(await readJsonBody(req, 4096))
        if (!body.success) {
            throw new AccountError(
                "Invalid username or password",
                400,
                "invalid_input",
            )
        }
        const { username, password } = body.data
        if (isLoginRateLimited(username)) {
            throw new AccountError(
                "Too many login attempts",
                429,
                "rate_limited",
            )
        }
        const user = findUserByUsername(username)
        const valid = user
            ? await verifyPassword(password, user.passwordHash)
            : false
        if (!user || !valid) {
            recordLoginFailure(username)
            throw new AccountError(
                "Invalid username or password",
                401,
                "invalid_credentials",
            )
        }
        if (user.disabled) {
            throw new AccountError(
                "Account is disabled",
                403,
                "account_disabled",
            )
        }
        resetLoginRate(username)
        touchLastLogin(user.id)
        const session = createAuthSession(user.id)
        return jsonWithSession(
            { user: { id: user.id, username: user.username } },
            session.token,
            req,
        )
    } catch (error) {
        return accountErrorResponse(error)
    }
}
