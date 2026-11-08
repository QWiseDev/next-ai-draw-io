"use client"

import { useParams } from "next/navigation"
import { type FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { accountFetch } from "@/lib/account-client"
import { getBasePath } from "@/lib/base-path"
import { getAccountTexts } from "@/lib/i18n/account-texts"

export function LoginForm() {
    const params = useParams<{ lang: string }>()
    const texts = getAccountTexts(params?.lang)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        setError("")
        setLoading(true)
        try {
            await accountFetch("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            })
            window.location.assign(`${getBasePath()}/${params.lang}/files`)
        } catch {
            setError(texts.loginFailed)
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
            <form
                onSubmit={submit}
                className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-float"
            >
                <h1 className="text-xl font-semibold">{texts.loginTitle}</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    {texts.loginSubtitle}
                </p>
                <label className="mt-5 block text-[13px] font-medium">
                    {texts.username}
                    <Input
                        className="mt-1.5"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoComplete="username"
                        autoFocus
                        required
                    />
                </label>
                <label className="mt-4 block text-[13px] font-medium">
                    {texts.password}
                    <Input
                        className="mt-1.5"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                    />
                </label>
                {error && (
                    <p
                        role="alert"
                        className="mt-3 text-[13px] text-destructive"
                    >
                        {error}
                    </p>
                )}
                <Button className="mt-5 w-full" disabled={loading}>
                    {loading ? texts.signingIn : texts.signIn}
                </Button>
            </form>
        </div>
    )
}
