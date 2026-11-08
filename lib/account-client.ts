import { AccountError } from "@/lib/account/errors"
import { getApiEndpoint } from "@/lib/base-path"

export async function accountFetch<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const headers = new Headers(init.headers)
    if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
    }
    const response = await fetch(getApiEndpoint(path), {
        ...init,
        credentials: "same-origin",
        headers,
    })
    if (response.status === 204) return undefined as T
    const data = await response.json().catch(() => null)
    if (!response.ok) {
        throw new AccountError(
            data?.error ?? `Request failed with status ${response.status}`,
            response.status,
            data?.code ?? "request_failed",
        )
    }
    return data as T
}
