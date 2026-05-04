/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Hugging Face REST API client — search + model-file listing.
 *
 * Phase 2 of PR 6 (Model-Hub browser hardening):
 *   - Endpoint is configurable via `LLMRuntimeConfig.huggingFaceEndpoint`
 *     (default `https://huggingface.co`). Tests that mock `fetch` are
 *     unaffected because the resolved default URL is byte-identical.
 *   - All public functions accept `AbortSignal`.
 *   - Optional bearer token is plumbed through the request helper but
 *     not yet sourced from `secureStorage` — that lands in Phase 7
 *     together with the gated-repo dialog.
 *   - Non-2xx responses become typed errors (`HFGatedError`,
 *     `HFRateLimitError`, `HFNetworkError`).
 *
 * Behaviour preserved from Phase 1:
 *   - Per-result heuristic that picks one Q4/Q5 file out of the GGUF
 *     siblings. Phase 3 replaces this with a per-quant grouper that
 *     returns *all* GGUF files; the current heuristic stays in place
 *     until the UI is ready to consume the new shape.
 *   - All `console.error` log lines and the surrounding try/catch shape.
 */

import { getLLMRuntimeConfig } from '../llm-runtime/config'
import type { HuggingFaceModel } from '../types'
import type { HFSearchResult } from './types'
import { HFGatedError, HFNetworkError, HFRateLimitError, parseRetryAfter } from './errors'

/**
 * Default origin used when `LLMRuntimeConfig.huggingFaceEndpoint` is
 * unset. Exported for tests and for `download.ts` to share.
 */
export const DEFAULT_HF_ENDPOINT = 'https://huggingface.co'

/** Backwards-compatible alias retained so existing imports keep working. */
export const HF_API_BASE = `${DEFAULT_HF_ENDPOINT}/api`

export const GGUF_EXTENSIONS = ['.gguf', '.ggml', '.bin']

export interface HFRequestOptions {
  /** Abort the in-flight fetch. Forwarded straight to `fetch`. */
  signal?: AbortSignal
  /**
   * Override the configured endpoint for this single call. Mostly used
   * by tests; production code should set `huggingFaceEndpoint` on
   * `LLMRuntimeConfig` instead so every call honours the override.
   */
  endpoint?: string
  /**
   * Optional bearer token. When the gated-repo flow lands (Phase 7),
   * the browser passes the user's HF token here; the API client never
   * reads `secureStorage` directly.
   */
  token?: string
}

/** Resolve the configured HF origin, stripping any trailing slash. */
function resolveEndpoint(opts?: HFRequestOptions): string {
  const explicit = opts?.endpoint
  if (typeof explicit === 'string' && explicit.length > 0) {
    return explicit.replace(/\/+$/, '')
  }
  const cfg = getLLMRuntimeConfig().huggingFaceEndpoint
  if (typeof cfg === 'string' && cfg.length > 0) {
    return cfg.replace(/\/+$/, '')
  }
  return DEFAULT_HF_ENDPOINT
}

/** Compose the `/api` URL for a relative path (`models`, `models/{id}`, …). */
export function apiUrl(path: string, opts?: HFRequestOptions): string {
  const origin = resolveEndpoint(opts)
  const clean = path.replace(/^\/+/, '')
  return `${origin}/api/${clean}`
}

/** Compose the file-resolve URL: `<origin>/{modelId}/resolve/main/{file}`. */
export function resolveFileUrl(modelId: string, filename: string, opts?: HFRequestOptions): string {
  const origin = resolveEndpoint(opts)
  return `${origin}/${modelId}/resolve/main/${filename}`
}

/**
 * Single-source HTTP helper used by every public function in this module.
 * Adds the bearer token (when present), forwards the `AbortSignal`, and
 * upgrades non-2xx responses into the typed error hierarchy.
 */
export async function hfRequest(url: string, opts?: HFRequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts?.token && opts.token.length > 0) {
    headers.Authorization = `Bearer ${opts.token}`
  }
  let response: Response
  try {
    response = await fetch(url, { headers, signal: opts?.signal })
  } catch (cause) {
    // Re-throw AbortError untouched so callers can branch on it via
    // `cause.name === 'AbortError'` or `signal.aborted`.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new HFNetworkError(
      `Network error while contacting Hugging Face: ${(cause as Error)?.message ?? 'unknown'}`,
      { url, cause },
    )
  }
  if (response.ok) return response
  if (response.status === 401 || response.status === 403) {
    throw new HFGatedError({ url, status: response.status })
  }
  if (response.status === 429) {
    throw new HFRateLimitError({
      url,
      retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
    })
  }
  throw new HFNetworkError(`HuggingFace API error: ${response.statusText || response.status}`, {
    status: response.status,
    url,
  })
}

export async function searchHuggingFaceModels(
  query: string,
  limit = 20,
  opts?: HFRequestOptions,
): Promise<HuggingFaceModel[]> {
  try {
    const searchUrl = `${apiUrl('models', opts)}?search=${encodeURIComponent(
      query,
    )}&filter=gguf&sort=downloads&limit=${limit}`

    const response = await hfRequest(searchUrl, opts)
    const results: HFSearchResult[] = await response.json()

    const models = await Promise.all(
      results.map(async (result) => {
        try {
          const ggufFiles =
            result.siblings?.filter((file) =>
              GGUF_EXTENSIONS.some((ext) => file.rfilename.toLowerCase().endsWith(ext)),
            ) || []

          if (ggufFiles.length === 0) {
            return null
          }

          const mainFile =
            ggufFiles.find(
              (f) =>
                f.rfilename.toLowerCase().includes('q4') ||
                f.rfilename.toLowerCase().includes('q5'),
            ) || ggufFiles[0]

          const quantMatch = mainFile.rfilename.match(/[Qq](\d+)[_-]?([KkMm])?[_-]?([SMLsml])?/i)
          const quantization = quantMatch ? quantMatch[0].toUpperCase() : 'GGUF'

          const contextMatch = result.modelId.match(/(\d+)[kK]/)
          const contextLength = contextMatch ? parseInt(contextMatch[1]) * 1024 : 4096

          const author = result.modelId.split('/')[0]
          const name = result.modelId.split('/')[1]

          return {
            id: result.modelId,
            name: name.replace(/-GGUF$/, ''),
            author,
            downloads: result.downloads || 0,
            likes: result.likes || 0,
            size: mainFile.size / (1024 * 1024 * 1024),
            quantization,
            contextLength,
            tags: result.tags
              .filter((tag) => !tag.startsWith('license:') && !tag.startsWith('region-'))
              .slice(0, 5),
            description: `${name.replace(/-/g, ' ')} - ${quantization} quantized GGUF model`,
            downloadUrl: resolveFileUrl(result.modelId, mainFile.rfilename, opts),
          } as HuggingFaceModel
        } catch (error) {
          console.error(`Error processing model ${result.modelId}:`, error)
          return null
        }
      }),
    )

    return models.filter((m): m is HuggingFaceModel => m !== null)
  } catch (error) {
    console.error('Error searching HuggingFace:', error)
    throw error
  }
}

export async function getModelFiles(
  modelId: string,
  opts?: HFRequestOptions,
): Promise<Array<{ name: string; size: number; url: string }>> {
  try {
    const response = await hfRequest(apiUrl(`models/${modelId}`, opts), opts)
    const data: HFSearchResult = await response.json()

    const ggufFiles =
      data.siblings?.filter((file) =>
        GGUF_EXTENSIONS.some((ext) => file.rfilename.toLowerCase().endsWith(ext)),
      ) || []

    return ggufFiles.map((file) => ({
      name: file.rfilename,
      size: file.size,
      url: resolveFileUrl(modelId, file.rfilename, opts),
    }))
  } catch (error) {
    console.error('Error fetching model files:', error)
    throw error
  }
}
