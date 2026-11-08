"use client"

import { useParams, usePathname, useRouter } from "next/navigation"
import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useState,
} from "react"
import type { AccountConfig } from "@/lib/account/types"
import { accountFetch } from "@/lib/account-client"
import { getBasePath } from "@/lib/base-path"

interface AccountContextValue extends AccountConfig {
    loading: boolean
    logout: () => Promise<void>
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({
    children,
    initialConfig,
}: {
    children: ReactNode
    initialConfig?: AccountConfig
}) {
    const params = useParams<{ lang?: string }>()
    const lang = params?.lang ?? "en"
    const router = useRouter()
    const pathname = usePathname()
    const [config, setConfig] = useState<AccountConfig>(
        initialConfig ?? { enabled: false, user: null },
    )
    const [loading, setLoading] = useState(!initialConfig)

    useEffect(() => {
        if (initialConfig) return
        let cancelled = false
        accountFetch<AccountConfig>("/api/account/config")
            .then((next) => {
                if (!cancelled) setConfig(next)
            })
            .catch(() => {
                if (!cancelled) setConfig({ enabled: false, user: null })
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [initialConfig])

    useEffect(() => {
        if (loading || !config.enabled || config.user) return
        if (pathname?.endsWith("/login")) return
        router.replace(`/${lang}/login`)
    }, [config, loading, lang, pathname, router])

    const logout = async () => {
        try {
            await accountFetch("/api/auth/logout", {
                method: "POST",
                body: JSON.stringify({}),
            })
        } finally {
            window.location.assign(`${getBasePath()}/${lang}/login`)
        }
    }

    return (
        <AccountContext.Provider value={{ ...config, loading, logout }}>
            {children}
        </AccountContext.Provider>
    )
}

export function useAccount(): AccountContextValue {
    return (
        useContext(AccountContext) ?? {
            enabled: false,
            user: null,
            loading: false,
            logout: async () => {},
        }
    )
}
