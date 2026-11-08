import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { Workspace } from "@/components/workspace/workspace"
import { requireAccountPageUser } from "@/lib/account/page"
import { getDictionary, hasLocale } from "@/lib/i18n/dictionaries"

export default async function Home({
    params,
    searchParams,
}: {
    params: Promise<{ lang: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    // The layout renders at the same time and cannot stop this page, so an
    // address like /llms.txt is rejected here too (it was a 500)
    const { lang } = await params
    if (!hasLocale(lang)) notFound()
    const accountUser = await requireAccountPageUser(lang)
    // Signed-in users land in their file center; the editor opens for a
    // session (?session=) or an explicit new file (?new=)
    const query = await searchParams
    if (accountUser && !query.new && !query.session) {
        redirect(`/${lang}/files`)
    }
    const dict = await getDictionary(lang)
    return (
        <>
            {/* The workspace renders only in the browser, so the server's
                HTML is otherwise empty for crawlers that do not run
                JavaScript. Visually hidden; it repeats the start screen. */}
            <div className="sr-only">
                <h1>Next AI Draw.io</h1>
                <p>{dict.lobby.lede}</p>
                <Link href={`/${lang}/about`}>{dict.settings.tabAbout}</Link>
            </div>
            {/* The workspace reads ?session= from the URL, which needs a
                Suspense boundary */}
            <Suspense fallback={<div className="fixed inset-0 bg-canvas" />}>
                <Workspace />
            </Suspense>
        </>
    )
}
