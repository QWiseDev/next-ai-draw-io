import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { FilesApp } from "@/components/files/files-app"
import { AccountProvider } from "@/contexts/account-context"
import { isAccountMode } from "@/lib/account/db"
import { requireAccountPageUser } from "@/lib/account/page"
import { hasLocale } from "@/lib/i18n/dictionaries"

export const metadata: Metadata = {
    title: "My files - Next AI Draw.io",
    robots: { index: false, follow: false },
}

export default async function FilesPage({
    params,
}: {
    params: Promise<{ lang: string }>
}) {
    const { lang } = await params
    if (!hasLocale(lang) || !isAccountMode()) notFound()
    const user = await requireAccountPageUser(lang)
    if (!user) notFound()
    return (
        <AccountProvider initialConfig={{ enabled: true, user }}>
            <FilesApp />
        </AccountProvider>
    )
}
