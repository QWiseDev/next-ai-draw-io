"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminUserRow } from "@/lib/account/types"
import { getAdminUsersTexts } from "@/lib/i18n/admin-users-texts"
import { formatMessage } from "@/lib/i18n/utils"
import { formatRelativeTime } from "@/lib/relative-time"
import { cn } from "@/lib/utils"
import { adminFetch } from "./admin-shared"

function generatePassword(): string {
    const bytes = new Uint8Array(12)
    crypto.getRandomValues(bytes)
    let raw = ""
    for (const byte of bytes) raw += String.fromCharCode(byte)
    return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function UsersSection({ password }: { password: string }) {
    const params = useParams<{ lang: string }>()
    const t = getAdminUsersTexts(params?.lang)
    const locale = params?.lang ?? "en"
    const [users, setUsers] = useState<AdminUserRow[] | null>(null)
    const [modeOff, setModeOff] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [creating, setCreating] = useState(false)
    const [formError, setFormError] = useState("")
    const [username, setUsername] = useState("")
    const [createPassword, setCreatePassword] = useState("")
    const [rowBusy, setRowBusy] = useState<number | null>(null)
    const [oneTime, setOneTime] = useState<{
        username: string
        password: string
    } | null>(null)
    const [disableTarget, setDisableTarget] = useState<AdminUserRow | null>(
        null,
    )
    const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null)
    const [deleteInput, setDeleteInput] = useState("")

    const load = useCallback(async () => {
        try {
            const data = await adminFetch("/api/admin/accounts", password)
            setUsers(Array.isArray(data.users) ? data.users : [])
            setModeOff(false)
            setLoadError(false)
        } catch (error) {
            if (error instanceof Error && /404|disabled/i.test(error.message)) {
                setModeOff(true)
            } else {
                setLoadError(true)
            }
        }
    }, [password])

    useEffect(() => {
        void load()
    }, [load])

    const createUser = async () => {
        setCreating(true)
        try {
            await adminFetch("/api/admin/accounts", password, {
                method: "POST",
                body: JSON.stringify({
                    username: username.trim(),
                    password: createPassword,
                }),
            })
            setUsername("")
            setCreatePassword("")
            setFormError("")
            await load()
        } catch (error) {
            setFormError(error instanceof Error ? error.message : "")
        } finally {
            setCreating(false)
        }
    }

    const patchUser = async (
        row: AdminUserRow,
        body: Record<string, unknown>,
    ): Promise<string | undefined> => {
        setRowBusy(row.id)
        try {
            const data = await adminFetch(
                `/api/admin/accounts/${row.id}`,
                password,
                { method: "PATCH", body: JSON.stringify(body) },
            )
            await load()
            return typeof data.password === "string" ? data.password : undefined
        } finally {
            setRowBusy(null)
        }
    }

    const deleteUser = async (row: AdminUserRow) => {
        setRowBusy(row.id)
        try {
            await adminFetch(`/api/admin/accounts/${row.id}`, password, {
                method: "DELETE",
            })
            setDeleteTarget(null)
            await load()
        } finally {
            setRowBusy(null)
        }
    }

    if (modeOff) {
        return (
            <p className="text-sm text-muted-foreground">{t.accountModeOff}</p>
        )
    }
    if (loadError) {
        return (
            <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">{t.loadFailed}</p>
                <Button variant="outline" size="sm" onClick={() => void load()}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>
        )
    }
    if (users === null) {
        return <Loader2 className="size-5 animate-spin text-muted-foreground" />
    }

    return (
        <div className="space-y-6">
            <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-3 text-sm font-medium">{t.create}</h3>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <div className="space-y-1.5">
                        <Label htmlFor="new-user-name">{t.username}</Label>
                        <Input
                            id="new-user-name"
                            value={username}
                            onChange={(event) =>
                                setUsername(event.target.value)
                            }
                            autoComplete="off"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="new-user-password">{t.password}</Label>
                        <div className="flex gap-2">
                            <Input
                                id="new-user-password"
                                value={createPassword}
                                onChange={(event) =>
                                    setCreatePassword(event.target.value)
                                }
                                autoComplete="new-password"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCreatePassword(generatePassword())
                                }
                            >
                                {t.generatePassword}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t.randomPasswordHint}
                        </p>
                    </div>
                    <Button
                        onClick={() => void createUser()}
                        disabled={
                            creating ||
                            !username.trim() ||
                            createPassword.length < 10
                        }
                    >
                        {creating && (
                            <Loader2 className="size-4 animate-spin" />
                        )}
                        {t.create}
                    </Button>
                </div>
                {formError && (
                    <p className="mt-2 text-sm text-destructive">{formError}</p>
                )}
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
                {users.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                        {t.empty}
                    </p>
                ) : (
                    <ul className="divide-y">
                        {users.map((row) => (
                            <li
                                key={row.id}
                                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                            >
                                <span className="min-w-0 shrink font-medium">
                                    {row.username}
                                </span>
                                <span
                                    className={cn(
                                        "text-xs",
                                        row.disabled
                                            ? "text-destructive"
                                            : "text-emerald-600",
                                    )}
                                >
                                    {row.disabled
                                        ? t.statusDisabled
                                        : t.statusActive}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {formatMessage(t.filesCount, {
                                        count: row.fileCount,
                                    })}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {row.lastLoginAt
                                        ? formatRelativeTime(
                                              row.lastLoginAt,
                                              locale,
                                              t.never,
                                          )
                                        : t.never}
                                </span>
                                <div className="ml-auto flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={rowBusy === row.id}
                                        onClick={() => {
                                            void patchUser(row, {
                                                action: "reset_password",
                                            }).then((newPassword) => {
                                                if (newPassword) {
                                                    setOneTime({
                                                        username: row.username,
                                                        password: newPassword,
                                                    })
                                                }
                                            })
                                        }}
                                    >
                                        {t.resetPassword}
                                    </Button>
                                    {row.disabled ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={rowBusy === row.id}
                                            onClick={() =>
                                                void patchUser(row, {
                                                    action: "enable",
                                                })
                                            }
                                        >
                                            {t.enable}
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={rowBusy === row.id}
                                            onClick={() =>
                                                setDisableTarget(row)
                                            }
                                        >
                                            {t.disable}
                                        </Button>
                                    )}
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={rowBusy === row.id}
                                        onClick={() => {
                                            setDeleteTarget(row)
                                            setDeleteInput("")
                                        }}
                                    >
                                        {t.delete}
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* The one-time password after a reset; the server keeps no copy */}
            <AlertDialog
                open={oneTime !== null}
                onOpenChange={(open) => !open && setOneTime(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{oneTime?.username}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t.newPasswordOneTime}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <code className="block rounded bg-muted px-3 py-2 font-mono text-sm select-all">
                        {oneTime?.password}
                    </code>
                    <AlertDialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (oneTime) {
                                    void navigator.clipboard.writeText(
                                        oneTime.password,
                                    )
                                }
                            }}
                        >
                            {t.copy}
                        </Button>
                        <AlertDialogAction onClick={() => setOneTime(null)}>
                            {t.confirm}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={disableTarget !== null}
                onOpenChange={(open) => !open && setDisableTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {formatMessage(t.confirmDisable, {
                                name: disableTarget?.username ?? "",
                            })}
                        </AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (disableTarget) {
                                    void patchUser(disableTarget, {
                                        action: "disable",
                                    })
                                }
                                setDisableTarget(null)
                            }}
                        >
                            {t.confirm}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {formatMessage(t.confirmDelete, {
                                name: deleteTarget?.username ?? "",
                            })}
                        </AlertDialogTitle>
                    </AlertDialogHeader>
                    <Input
                        value={deleteInput}
                        onChange={(event) => setDeleteInput(event.target.value)}
                        placeholder={deleteTarget?.username}
                        autoComplete="off"
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleteInput !== deleteTarget?.username}
                            onClick={() => {
                                if (deleteTarget) void deleteUser(deleteTarget)
                            }}
                        >
                            {t.confirm}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
