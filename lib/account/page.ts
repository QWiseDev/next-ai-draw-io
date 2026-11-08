import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SESSION_COOKIE } from "./api"
import { isAccountMode } from "./db"
import { findUserBySessionToken } from "./store"
import type { AccountUser } from "./types"

export async function getAccountPageUser(): Promise<AccountUser | null> {
    if (!isAccountMode()) return null
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    return token ? findUserBySessionToken(token) : null
}

export async function requireAccountPageUser(
    lang: string,
): Promise<AccountUser | null> {
    if (!isAccountMode()) return null
    const user = await getAccountPageUser()
    if (!user) redirect(`/${lang}/login`)
    return user
}
