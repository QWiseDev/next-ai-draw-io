"use client"

import { useParams, useRouter } from "next/navigation"
import { BrandMark } from "@/components/workspace/brand-mark"
import { useAccount } from "@/contexts/account-context"
import { useDictionary } from "@/hooks/use-dictionary"
import { cn } from "@/lib/utils"

/** Account mode: the logo goes to the file center; anonymous: static */
export function HomeLogo({ className }: { className?: string }) {
    const account = useAccount()
    const router = useRouter()
    const params = useParams<{ lang: string }>()
    const dict = useDictionary()
    if (!account.enabled) return <BrandMark className={className} />
    return (
        <button
            type="button"
            aria-label={dict.nav.diagrams}
            onClick={() => router.push(`/${params.lang}/files`)}
            className="shrink-0 cursor-pointer"
        >
            <BrandMark className={cn(className)} />
        </button>
    )
}
