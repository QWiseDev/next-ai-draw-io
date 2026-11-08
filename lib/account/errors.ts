export class AccountError extends Error {
    constructor(
        message: string,
        public readonly status = 400,
        public readonly code = "bad_request",
    ) {
        super(message)
        this.name = "AccountError"
    }
}

export function accountErrorResponse(error: unknown): Response {
    if (error instanceof AccountError) {
        return Response.json(
            { error: error.message, code: error.code },
            { status: error.status },
        )
    }
    console.error("[account] Unexpected error:", error)
    return Response.json(
        { error: "Internal server error", code: "internal" },
        { status: 500 },
    )
}
