"use client"

import {
    Clock,
    Folder,
    FolderInput,
    FolderPlus,
    LayoutGrid,
    List,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    Sparkles,
    Trash2,
    Upload,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AccountMenu } from "@/components/account/account-menu"
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
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAccount } from "@/contexts/account-context"
import { AccountError } from "@/lib/account/errors"
import type { AccountFolder, CloudDocumentMetadata } from "@/lib/account/types"
import { accountFetch } from "@/lib/account-client"
import { getAccountTexts } from "@/lib/i18n/account-texts"
import { formatRelativeTime } from "@/lib/relative-time"
import { getAllSessionMetadata, getSession } from "@/lib/session-storage"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"

type View = "recent" | "files" | "trash"
type Sort = "updated" | "created" | "title"
type FileDialog =
    | { type: "newFolder" }
    | { type: "renameFolder"; folder: AccountFolder }
    | { type: "renameFile"; file: CloudDocumentMetadata }
    | { type: "moveFile"; file: CloudDocumentMetadata }
type ConfirmAction =
    | { type: "deleteFile"; file: CloudDocumentMetadata }
    | { type: "purgeFile"; file: CloudDocumentMetadata }
    | { type: "deleteFolder"; folder: AccountFolder }

export function FilesApp() {
    const params = useParams<{ lang: string }>()
    const lang = params?.lang ?? "en"
    const router = useRouter()
    const { user } = useAccount()
    const texts = getAccountTexts(lang)
    const [view, setView] = useState<View>("files")
    const [folderId, setFolderId] = useState<string | null>(null)
    const [files, setFiles] = useState<CloudDocumentMetadata[]>([])
    const [folders, setFolders] = useState<AccountFolder[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [query, setQuery] = useState("")
    const [sort, setSort] = useState<Sort>("updated")
    const [layout, setLayout] = useState<"grid" | "list">("grid")
    const [dialog, setDialog] = useState<FileDialog | null>(null)
    const [draftName, setDraftName] = useState("")
    const [moveTarget, setMoveTarget] = useState("root")
    const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
    const [importing, setImporting] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setError(false)
        try {
            const filesPath =
                view === "trash"
                    ? "/api/account/files?view=trash"
                    : view === "recent"
                      ? "/api/account/files?view=recent"
                      : `/api/account/files?view=all&folder=${folderId ?? "root"}`
            const [filesResult, foldersResult] = await Promise.all([
                accountFetch<{ files: CloudDocumentMetadata[] }>(filesPath),
                accountFetch<{ folders: AccountFolder[] }>(
                    "/api/account/folders",
                ),
            ])
            setFiles(filesResult.files)
            setFolders(foldersResult.folders)
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [view, folderId])

    useEffect(() => {
        void load()
    }, [load])

    const shownTitle = (title: string) =>
        !title || title === "New Chat" ? texts.untitled : title

    const visibleFiles = useMemo(() => {
        const filtered = files.filter((file) =>
            shownTitle(file.title)
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
        )
        return filtered.sort((left, right) => {
            if (sort === "title") {
                return shownTitle(left.title).localeCompare(
                    shownTitle(right.title),
                )
            }
            if (sort === "created") return right.createdAt - left.createdAt
            return right.updatedAt - left.updatedAt
        })
    }, [files, query, sort, texts.untitled])

    const currentFolder = folders.find((folder) => folder.id === folderId)
    const showFolders = view === "files" && folderId === null

    const openFile = (file: CloudDocumentMetadata) => {
        if (view === "trash") return
        router.push(`/${lang}?session=${encodeURIComponent(file.id)}`)
    }

    const createFile = () => {
        useUiStore.getState().setHeroDismissed(true)
        router.push(`/${lang}?new=blank`)
    }

    const openAiLobby = () => {
        useUiStore.getState().setHeroDismissed(false)
        router.push(`/${lang}?new=ai`)
    }

    const importLocalFiles = async () => {
        setImporting(true)
        try {
            const metadata = await getAllSessionMetadata()
            let count = 0
            for (const item of metadata) {
                const session = await getSession(item.id)
                if (!session) continue
                try {
                    await accountFetch("/api/account/files", {
                        method: "POST",
                        body: JSON.stringify({
                            payload: session,
                            folderId: view === "files" ? folderId : null,
                        }),
                    })
                    count++
                } catch (error) {
                    if (
                        !(error instanceof AccountError && error.status === 409)
                    ) {
                        throw error
                    }
                }
            }
            toast.success(texts.importDone.replace("{count}", String(count)))
            await load()
        } catch {
            toast.error(texts.importFailed)
        } finally {
            setImporting(false)
        }
    }

    const openRenameFile = (file: CloudDocumentMetadata) => {
        setDraftName(shownTitle(file.title))
        setDialog({ type: "renameFile", file })
    }

    const openMoveFile = (file: CloudDocumentMetadata) => {
        setMoveTarget(file.folderId ?? "root")
        setDialog({ type: "moveFile", file })
    }

    const submitDialog = async () => {
        if (!dialog) return
        try {
            if (dialog.type === "newFolder") {
                await accountFetch("/api/account/folders", {
                    method: "POST",
                    body: JSON.stringify({ name: draftName }),
                })
            } else if (dialog.type === "renameFolder") {
                await accountFetch(
                    `/api/account/folders/${encodeURIComponent(dialog.folder.id)}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({ name: draftName }),
                    },
                )
            } else if (dialog.type === "renameFile") {
                await accountFetch(
                    `/api/account/files/${encodeURIComponent(dialog.file.id)}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            title: draftName,
                            expectedRevision: dialog.file.revision,
                        }),
                    },
                )
            } else {
                await accountFetch(
                    `/api/account/files/${encodeURIComponent(dialog.file.id)}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            folderId: moveTarget === "root" ? null : moveTarget,
                            expectedRevision: dialog.file.revision,
                        }),
                    },
                )
            }
            setDialog(null)
            await load()
        } catch {
            toast.error(texts.cloudSaveFailed)
        }
    }

    const runConfirm = async () => {
        if (!confirm) return
        try {
            if (confirm.type === "deleteFolder") {
                await accountFetch(
                    `/api/account/folders/${encodeURIComponent(confirm.folder.id)}`,
                    { method: "DELETE" },
                )
                if (folderId === confirm.folder.id) setFolderId(null)
            } else {
                const permanent =
                    confirm.type === "purgeFile" ? "?permanent=true" : ""
                await accountFetch(
                    `/api/account/files/${encodeURIComponent(confirm.file.id)}${permanent}`,
                    { method: "DELETE" },
                )
            }
            setConfirm(null)
            await load()
        } catch {
            toast.error(texts.cloudDeleteFailed)
        }
    }

    const restoreFile = async (file: CloudDocumentMetadata) => {
        try {
            await accountFetch(
                `/api/account/files/${encodeURIComponent(file.id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        trash: false,
                        expectedRevision: file.revision,
                    }),
                },
            )
            await load()
        } catch {
            toast.error(texts.cloudSaveFailed)
        }
    }

    const navButton = (target: View, label: string, icon: React.ReactNode) => (
        <button
            type="button"
            onClick={() => {
                setView(target)
                setFolderId(null)
            }}
            className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] hover:bg-accent",
                view === target && folderId === null && "bg-accent font-medium",
            )}
        >
            {icon}
            {label}
        </button>
    )

    const fileActions = (file: CloudDocumentMetadata) => (
        <div className="flex items-center gap-0.5">
            {view === "trash" ? (
                <>
                    <button
                        type="button"
                        title={texts.restore}
                        aria-label={texts.restore}
                        onClick={(event) => {
                            event.stopPropagation()
                            void restoreFile(file)
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                        <RotateCcw className="size-4" />
                    </button>
                    <button
                        type="button"
                        title={texts.purge}
                        aria-label={texts.purge}
                        onClick={(event) => {
                            event.stopPropagation()
                            setConfirm({ type: "purgeFile", file })
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                        <Trash2 className="size-4" />
                    </button>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        title={texts.rename}
                        aria-label={texts.rename}
                        onClick={(event) => {
                            event.stopPropagation()
                            openRenameFile(file)
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                        <Pencil className="size-4" />
                    </button>
                    <button
                        type="button"
                        title={texts.move}
                        aria-label={texts.move}
                        onClick={(event) => {
                            event.stopPropagation()
                            openMoveFile(file)
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                        <FolderInput className="size-4" />
                    </button>
                    <button
                        type="button"
                        title={texts.delete}
                        aria-label={texts.delete}
                        onClick={(event) => {
                            event.stopPropagation()
                            setConfirm({ type: "deleteFile", file })
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                        <Trash2 className="size-4" />
                    </button>
                </>
            )}
        </div>
    )

    return (
        <div className="flex min-h-screen flex-col bg-canvas text-foreground md:flex-row">
            <aside className="flex w-full shrink-0 flex-col border-b border-border bg-card md:min-h-screen md:w-60 md:border-r md:border-b-0">
                <div className="flex items-center gap-2 px-4 py-4 text-[15px] font-semibold">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Folder className="size-4" />
                    </span>
                    Next AI Draw.io
                </div>
                <div className="grid grid-cols-2 gap-2 px-3 md:grid-cols-1">
                    <Button
                        onClick={() => void createFile()}
                        className="gap-1.5"
                    >
                        <Plus className="size-4" />
                        {texts.newFile}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={openAiLobby}
                        className="gap-1.5"
                    >
                        <Sparkles className="size-4" />
                        {texts.newAI}
                    </Button>
                </div>
                <nav className="mt-3 flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
                    {navButton(
                        "recent",
                        texts.recent,
                        <Clock className="size-4" />,
                    )}
                    {navButton(
                        "files",
                        texts.myFiles,
                        <Folder className="size-4" />,
                    )}
                    {navButton(
                        "trash",
                        texts.trash,
                        <Trash2 className="size-4" />,
                    )}
                    {view === "files" &&
                        folders.map((folder) => (
                            <button
                                key={folder.id}
                                type="button"
                                onClick={() => setFolderId(folder.id)}
                                className={cn(
                                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-accent md:pl-8",
                                    folderId === folder.id &&
                                        "bg-accent font-medium",
                                )}
                            >
                                <Folder className="size-4 shrink-0" />
                                <span className="truncate">{folder.name}</span>
                            </button>
                        ))}
                </nav>
                <div className="mt-auto hidden items-center gap-2 border-t border-border px-4 py-3 md:flex">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[12px] font-semibold text-primary">
                        {user?.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate text-[13px]">
                        {user?.username}
                    </span>
                </div>
            </aside>

            <main className="min-w-0 flex-1 overflow-y-auto">
                <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
                    <div className="relative min-w-40 flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={texts.search}
                            className="pl-9"
                        />
                    </div>
                    <select
                        value={sort}
                        onChange={(event) =>
                            setSort(event.target.value as Sort)
                        }
                        aria-label={texts.sort}
                        className="h-9 rounded-md border border-input bg-background px-2 text-[13px]"
                    >
                        <option value="updated">{texts.sortUpdated}</option>
                        <option value="created">{texts.sortCreated}</option>
                        <option value="title">{texts.sortTitle}</option>
                    </select>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label={layout === "grid" ? texts.list : texts.grid}
                        onClick={() =>
                            setLayout(layout === "grid" ? "list" : "grid")
                        }
                    >
                        {layout === "grid" ? <List /> : <LayoutGrid />}
                    </Button>
                    <AccountMenu />
                </header>

                <div className="px-4 py-5">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <h1 className="mr-auto text-lg font-semibold">
                            {view === "trash"
                                ? texts.trash
                                : view === "recent"
                                  ? texts.recent
                                  : (currentFolder?.name ?? texts.rootFolder)}
                        </h1>
                        {view !== "trash" && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => {
                                        setDraftName("")
                                        setDialog({ type: "newFolder" })
                                    }}
                                >
                                    <FolderPlus className="size-4" />
                                    {texts.newFolder}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={importing}
                                    onClick={() => void importLocalFiles()}
                                >
                                    <Upload className="size-4" />
                                    {importing
                                        ? texts.importing
                                        : texts.importLocal}
                                </Button>
                            </>
                        )}
                    </div>

                    {loading ? (
                        <p className="py-16 text-center text-[13px] text-muted-foreground">
                            …
                        </p>
                    ) : error ? (
                        <div className="py-16 text-center">
                            <p className="text-[13px] text-muted-foreground">
                                {texts.loadFailed}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => void load()}
                            >
                                {texts.retry}
                            </Button>
                        </div>
                    ) : (
                        <>
                            {showFolders && folders.length > 0 && (
                                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                                    {folders.map((folder) => (
                                        <div
                                            key={folder.id}
                                            className="group flex items-center gap-2 rounded-xl border border-border bg-card p-3 hover:bg-accent"
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFolderId(folder.id)
                                                }
                                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                            >
                                                <Folder className="size-5 shrink-0 text-amber-500" />
                                                <span className="min-w-0">
                                                    <span className="block truncate text-[13px] font-medium">
                                                        {folder.name}
                                                    </span>
                                                    <span className="block text-[11px] text-muted-foreground">
                                                        {texts.filesCount.replace(
                                                            "{count}",
                                                            String(
                                                                folder.fileCount,
                                                            ),
                                                        )}
                                                    </span>
                                                </span>
                                            </button>
                                            <div className="flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                                                <button
                                                    type="button"
                                                    title={texts.rename}
                                                    aria-label={texts.rename}
                                                    onClick={() => {
                                                        setDraftName(
                                                            folder.name,
                                                        )
                                                        setDialog({
                                                            type: "renameFolder",
                                                            folder,
                                                        })
                                                    }}
                                                    className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                                                >
                                                    <Pencil className="size-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    title={texts.delete}
                                                    aria-label={texts.delete}
                                                    onClick={() =>
                                                        setConfirm({
                                                            type: "deleteFolder",
                                                            folder,
                                                        })
                                                    }
                                                    className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {visibleFiles.length === 0 ? (
                                <p className="py-16 text-center text-[13px] text-muted-foreground">
                                    {query
                                        ? texts.noResults
                                        : view === "trash"
                                          ? texts.emptyTrash
                                          : texts.empty}
                                </p>
                            ) : layout === "grid" ? (
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                                    {visibleFiles.map((file) => (
                                        <div
                                            key={file.id}
                                            className="group overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => openFile(file)}
                                                className="block w-full text-left"
                                            >
                                                <span className="flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-border bg-white p-2">
                                                    {file.thumbnailDataUrl ? (
                                                        // biome-ignore lint/performance/noImgElement: data URL thumbnail
                                                        <img
                                                            src={
                                                                file.thumbnailDataUrl
                                                            }
                                                            alt=""
                                                            className="max-h-full max-w-full object-contain"
                                                        />
                                                    ) : (
                                                        <Folder className="size-8 text-muted-foreground/30" />
                                                    )}
                                                </span>
                                                <span className="block px-3 pt-2">
                                                    <span className="block truncate text-[13px] font-medium">
                                                        {shownTitle(file.title)}
                                                    </span>
                                                    <span className="block text-[11px] text-muted-foreground">
                                                        {formatRelativeTime(
                                                            file.updatedAt,
                                                            lang,
                                                            texts.justNow,
                                                        )}
                                                    </span>
                                                </span>
                                            </button>
                                            <div className="flex justify-end px-2 py-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                                                {fileActions(file)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl border border-border bg-card">
                                    {visibleFiles.map((file) => (
                                        <div
                                            key={file.id}
                                            className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-accent"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => openFile(file)}
                                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                            >
                                                <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                                                    {file.thumbnailDataUrl ? (
                                                        // biome-ignore lint/performance/noImgElement: data URL thumbnail
                                                        <img
                                                            src={
                                                                file.thumbnailDataUrl
                                                            }
                                                            alt=""
                                                            className="max-h-8 max-w-11 object-contain"
                                                        />
                                                    ) : (
                                                        <Folder className="size-4 text-muted-foreground/40" />
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[13px] font-medium">
                                                        {shownTitle(file.title)}
                                                    </span>
                                                    <span className="block text-[11px] text-muted-foreground">
                                                        {formatRelativeTime(
                                                            file.updatedAt,
                                                            lang,
                                                            texts.justNow,
                                                        )}
                                                    </span>
                                                </span>
                                            </button>
                                            {fileActions(file)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <Dialog
                open={!!dialog}
                onOpenChange={(open) => !open && setDialog(null)}
            >
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {dialog?.type === "newFolder" ||
                            dialog?.type === "renameFolder"
                                ? texts.folderName
                                : dialog?.type === "moveFile"
                                  ? texts.move
                                  : texts.fileName}
                        </DialogTitle>
                    </DialogHeader>
                    {dialog?.type === "moveFile" ? (
                        <select
                            value={moveTarget}
                            onChange={(event) =>
                                setMoveTarget(event.target.value)
                            }
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-[13px]"
                        >
                            <option value="root">{texts.rootFolder}</option>
                            {folders.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                    {folder.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <Input
                            value={draftName}
                            onChange={(event) =>
                                setDraftName(event.target.value)
                            }
                            maxLength={dialog?.type === "renameFile" ? 100 : 60}
                            autoFocus
                        />
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialog(null)}
                        >
                            {texts.cancel}
                        </Button>
                        <Button
                            onClick={() => void submitDialog()}
                            disabled={
                                dialog?.type !== "moveFile" && !draftName.trim()
                            }
                        >
                            {dialog?.type === "newFolder"
                                ? texts.create
                                : texts.save}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={!!confirm}
                onOpenChange={(open) => !open && setConfirm(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirm?.type === "purgeFile"
                                ? texts.confirmPurge
                                : confirm?.type === "deleteFolder"
                                  ? texts.confirmDeleteFolder
                                  : texts.confirmDeleteFile}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirm?.type === "purgeFile"
                                ? texts.confirmPurgeDesc
                                : confirm?.type === "deleteFolder"
                                  ? texts.confirmDeleteFolderDesc
                                  : texts.confirmDeleteFileDesc}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{texts.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => void runConfirm()}
                        >
                            {texts.delete}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
