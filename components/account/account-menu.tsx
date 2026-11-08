"use client"

import { FolderOpen, LogOut, User } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useAccount } from "@/contexts/account-context"
import { getAccountTexts } from "@/lib/i18n/account-texts"

export function AccountMenu() {
    const { enabled, user, logout } = useAccount()
    const params = useParams<{ lang: string }>()
    const texts = getAccountTexts(params?.lang)
    if (!enabled || !user) return null
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={texts.account}
                    className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary hover:bg-primary/20"
                >
                    {user.username.slice(0, 1).toUpperCase()}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5">
                <div className="flex items-center gap-2 px-2.5 py-2 text-[13px] font-medium">
                    <User className="size-4 text-muted-foreground" />
                    <span className="truncate">{user.username}</span>
                </div>
                <Link
                    href={`/${params.lang}/files`}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] hover:bg-accent"
                >
                    <FolderOpen className="size-4 text-muted-foreground" />
                    {texts.myFiles}
                </Link>
                <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-accent"
                >
                    <LogOut className="size-4 text-muted-foreground" />
                    {texts.logout}
                </button>
            </PopoverContent>
        </Popover>
    )
}
