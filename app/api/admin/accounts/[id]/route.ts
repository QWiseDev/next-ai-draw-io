import { randomBytes } from "node:crypto"
import { z } from "zod"
import { rejectCrossSite } from "@/lib/access-code"
import { readJsonBody } from "@/lib/account/api"
import { isAccountMode } from "@/lib/account/db"
import { AccountError, accountErrorResponse } from "@/lib/account/errors"
import { hashPassword } from "@/lib/account/password"
import {
    deleteUser,
    findUserById,
    setUserDisabled,
    updateUserPassword,
} from "@/lib/account/store"
import { checkAdminAuth } from "@/lib/admin/auth"

export const runtime = "nodejs"

const patchSchema = z.object({
    action: z.enum(["reset_password", "disable", "enable"]),
    password: z.string().min(10).max(128).optional(),
})

function generatePassword(): string {
    // 16 base64url characters: well past the 10-character minimum
    return randomBytes(12).toString("base64url")
}

async function resolveId(params: Promise<{ id: string }>): Promise<number> {
    const { id } = await params
    const userId = Number(id)
    if (!Number.isInteger(userId) || userId < 1) {
        throw new AccountError("Invalid user id", 400, "invalid_input")
    }
    return userId
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    try {
        if (!isAccountMode()) {
            throw new AccountError("Account mode is disabled", 404, "disabled")
        }
        const adminError = checkAdminAuth(req)
        if (adminError) return adminError
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const userId = await resolveId(params)
        if (!findUserById(userId)) {
            throw new AccountError("User not found", 404, "user_not_found")
        }
        const body = patchSchema.safeParse(await readJsonBody(req, 4096))
        if (!body.success) {
            throw new AccountError("Invalid request body", 400, "invalid_input")
        }
        const { action } = body.data
        if (action === "reset_password") {
            const password = body.data.password ?? generatePassword()
            updateUserPassword(userId, await hashPassword(password))
            return Response.json({ password })
        }
        const disabled = action === "disable"
        setUserDisabled(userId, disabled)
        return Response.json({ ok: true })
    } catch (error) {
        return accountErrorResponse(error)
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    try {
        if (!isAccountMode()) {
            throw new AccountError("Account mode is disabled", 404, "disabled")
        }
        const adminError = checkAdminAuth(req)
        if (adminError) return adminError
        const crossSite = rejectCrossSite(req)
        if (crossSite) return crossSite
        const userId = await resolveId(params)
        deleteUser(userId)
        return Response.json({ ok: true })
    } catch (error) {
        return accountErrorResponse(error)
    }
}
