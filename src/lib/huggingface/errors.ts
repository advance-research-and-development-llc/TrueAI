/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Typed errors for the Hugging Face integration. Phase 6 download
 * code branches on these:
 *   - `HFGatedError` → surface the HF-token paste dialog (Phase 7).
 *   - `HFRateLimitError` → back off, honour `Retry-After`, surface
 *     a "switch to single stream" toggle.
 *   - `HFNetworkError` → generic transport / non-2xx fallthrough.
 *
 * All three extend `Error` rather than a shared base so consumers can
 * use `instanceof` cleanly without importing a private root class.
 */

/** Generic non-2xx / transport failure when talking to the HF API. */
export class HFNetworkError extends Error {
  readonly status: number
  readonly url: string
  constructor(message: string, opts: { status?: number; url: string; cause?: unknown }) {
    super(message)
    this.name = 'HFNetworkError'
    this.status = opts.status ?? 0
    this.url = opts.url
    if (opts.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = opts.cause
    }
  }
}

/**
 * Thrown when the HF API returns 401 Unauthorized or 403 Forbidden
 * for a model the user is trying to access — typically a gated repo
 * (Llama-3, Gemma, Mistral-Instruct mirrors, …) that requires an
 * access token tied to an account that has accepted the model's
 * license. Phase 7 catches this and prompts for a token.
 */
export class HFGatedError extends HFNetworkError {
  readonly modelId?: string
  constructor(opts: { url: string; status: 401 | 403; modelId?: string; cause?: unknown }) {
    super(
      `Hugging Face returned ${opts.status} — this model may be gated. ` +
        `Provide an HF access token in Settings → Model Hub.`,
      { status: opts.status, url: opts.url, cause: opts.cause },
    )
    this.name = 'HFGatedError'
    this.modelId = opts.modelId
  }
}

/** Thrown on HTTP 429 with the server-suggested back-off (in ms). */
export class HFRateLimitError extends HFNetworkError {
  readonly retryAfterMs: number
  constructor(opts: { url: string; retryAfterMs: number; cause?: unknown }) {
    super(`Hugging Face API rate-limited (429). Retry after ${opts.retryAfterMs}ms.`, {
      status: 429,
      url: opts.url,
      cause: opts.cause,
    })
    this.name = 'HFRateLimitError'
    this.retryAfterMs = opts.retryAfterMs
  }
}

/**
 * Parse a `Retry-After` header (RFC 7231) into milliseconds.
 * Accepts both the numeric seconds form (`Retry-After: 30`) and the
 * HTTP-date form (`Retry-After: Wed, 21 Oct 2026 07:28:00 GMT`).
 * Returns `0` when the header is absent or unparseable so the caller
 * can fall back to its own back-off policy.
 */
export function parseRetryAfter(header: string | null): number {
  if (!header) return 0
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.floor(seconds * 1000)
  const date = Date.parse(header)
  if (Number.isFinite(date)) {
    const delta = date - Date.now()
    return delta > 0 ? delta : 0
  }
  return 0
}
