import { z } from "zod"
import { rejectCrossSite } from "@/lib/access-code"
import { readJsonBody } from "@/lib/account/api"
import { isAccountMode } from "@/lib/account/db"
import { AccountError, accountErrorResponse } from "@/lib/account/errors"
import { hashPassword } from "@/lib/account/password"
import { createUser } from "@/lib/account/store"
import { checkAdminAuth } from "@/lib/admin/auth"

export const runtime = "nodejs"

const accountSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(32)
        .regex(/^[A-Za-z0-9_.-]+$/)
        .transform((value) => value.toLowerCase()),
    password: z.string().min(10).max(128),
})

export async function POST(req: Request): Promise<Response> {
    try {
        if (!isAccountMode()) {
            throw new AccountError("Account mode is disabled", 404, "disabled")
        }
        const adminError = checkAdminAuth(req)
        if (adminError) return adminError
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const body = accountSchema.safeParse(await readJsonBody(req, 4096))
        if (!body.success) {
            throw new AccountError(
                "Username must be 3-32 letters, numbers, dots, underscores or hyphens; password must be at least 10 characters",
                400,
                "invalid_input",
            )
        }
        const passwordHash = await hashPassword(body.data.password)
        const user = createUser(body.data.username, passwordHash)
        return Response.json({ user }, { status: 201 })
    } catch (error) {
        return accountErrorResponse(error)
    }
}
