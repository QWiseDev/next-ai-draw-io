const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 10
const attempts = new Map<string, { count: number; resetAt: number }>()

export function isLoginRateLimited(key: string): boolean {
    const entry = attempts.get(key)
    if (!entry) return false
    if (Date.now() >= entry.resetAt) {
        attempts.delete(key)
        return false
    }
    return entry.count >= MAX_FAILURES
}

export function recordLoginFailure(key: string): void {
    const entry = attempts.get(key)
    if (!entry || Date.now() >= entry.resetAt) {
        attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS })
        return
    }
    entry.count++
}

export function resetLoginRate(key: string): void {
    attempts.delete(key)
}
