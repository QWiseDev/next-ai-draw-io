import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { LoginForm } from "@/components/account/login-form"
import { isAccountMode } from "@/lib/account/db"
import { getAccountPageUser } from "@/lib/account/page"
import { hasLocale } from "@/lib/i18n/dictionaries"

export const metadata: Metadata = {
    title: "Sign in - Next AI Draw.io",
    robots: { index: false, follow: false },
}

export default async function LoginPage({
    params,
}: {
    params: Promise<{ lang: string }>
}) {
    const { lang } = await params
    if (!hasLocale(lang) || !isAccountMode()) notFound()
    if (await getAccountPageUser()) redirect(`/${lang}/files`)
    return <LoginForm />
}
