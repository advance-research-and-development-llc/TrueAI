/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Tests for the typed error hierarchy and Phase 2 API hardening:
 *   - `HFGatedError` / `HFRateLimitError` / `HFNetworkError` thrown
 *     for the corresponding HTTP statuses.
 *   - `parseRetryAfter` accepts both numeric-seconds and HTTP-date.
 *   - `apiUrl` / `resolveFileUrl` honour `huggingFaceEndpoint`
 *     overrides + strip trailing slash.
 *   - `searchHuggingFaceModels` forwards `AbortSignal` to `fetch`.
 *   - `hfRequest` attaches the bearer token only when provided.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HFGatedError,
  HFNetworkError,
  HFRateLimitError,
  apiUrl,
  hfRequest,
  parseRetryAfter,
  resolveFileUrl,
  searchHuggingFaceModels,
} from './huggingface'

describe('huggingface — Phase 2 hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('parseRetryAfter', () => {
    it('returns 0 for null / unparseable', () => {
      expect(parseRetryAfter(null)).toBe(0)
      expect(parseRetryAfter('garbage')).toBe(0)
    })

    it('parses seconds form', () => {
      expect(parseRetryAfter('30')).toBe(30_000)
      expect(parseRetryAfter('0')).toBe(0)
    })

    it('parses HTTP-date form into a non-negative ms delta', () => {
      const future = new Date(Date.now() + 5_000).toUTCString()
      const ms = parseRetryAfter(future)
      // Allow some scheduler slack — must be roughly within the next 5s.
      expect(ms).toBeGreaterThan(0)
      expect(ms).toBeLessThanOrEqual(6_000)
    })

    it('returns 0 for past dates', () => {
      const past = new Date(Date.now() - 60_000).toUTCString()
      expect(parseRetryAfter(past)).toBe(0)
    })
  })

  describe('apiUrl / resolveFileUrl', () => {
    it('uses the default endpoint when nothing overrides it', () => {
      expect(apiUrl('models')).toBe('https://huggingface.co/api/models')
      expect(resolveFileUrl('a/b', 'm.gguf')).toBe(
        'https://huggingface.co/a/b/resolve/main/m.gguf',
      )
    })

    it('honours an explicit endpoint override and strips trailing slashes', () => {
      const opts = { endpoint: 'https://hf-mirror.com//' }
      expect(apiUrl('models', opts)).toBe('https://hf-mirror.com/api/models')
      expect(resolveFileUrl('a/b', 'm.gguf', opts)).toBe(
        'https://hf-mirror.com/a/b/resolve/main/m.gguf',
      )
    })
  })

  describe('hfRequest typed errors', () => {
    it('throws HFGatedError on 401', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('nope', { status: 401, statusText: 'Unauthorized' })),
      )
      await expect(hfRequest('https://example/x')).rejects.toBeInstanceOf(HFGatedError)
    })

    it('throws HFGatedError on 403', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('nope', { status: 403, statusText: 'Forbidden' })),
      )
      await expect(hfRequest('https://example/x')).rejects.toBeInstanceOf(HFGatedError)
    })

    it('throws HFRateLimitError on 429 with parsed Retry-After', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response('slow down', {
              status: 429,
              statusText: 'Too Many Requests',
              headers: { 'Retry-After': '15' },
            }),
        ),
      )
      try {
        await hfRequest('https://example/x')
        expect.fail('expected throw')
      } catch (e) {
        expect(e).toBeInstanceOf(HFRateLimitError)
        expect((e as HFRateLimitError).retryAfterMs).toBe(15_000)
      }
    })

    it('throws HFNetworkError on other non-2xx', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('boom', { status: 500, statusText: 'Server Error' })),
      )
      try {
        await hfRequest('https://example/x')
        expect.fail('expected throw')
      } catch (e) {
        expect(e).toBeInstanceOf(HFNetworkError)
        // HFGatedError extends HFNetworkError, so check the more specific subtype
        // is *not* matched here.
        expect(e).not.toBeInstanceOf(HFGatedError)
        expect(e).not.toBeInstanceOf(HFRateLimitError)
        expect((e as HFNetworkError).status).toBe(500)
      }
    })

    it('wraps thrown fetch (e.g. DNS) into HFNetworkError', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        }),
      )
      try {
        await hfRequest('https://example/x')
        expect.fail('expected throw')
      } catch (e) {
        expect(e).toBeInstanceOf(HFNetworkError)
      }
    })

    it('passes through AbortError untouched', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          const err = new DOMException('aborted', 'AbortError')
          throw err
        }),
      )
      await expect(hfRequest('https://example/x')).rejects.toMatchObject({
        name: 'AbortError',
      })
    })

    it('attaches bearer token only when provided', async () => {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)

      await hfRequest('https://example/x')
      const firstHeaders = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
        string,
        string
      >
      expect(firstHeaders.Authorization).toBeUndefined()

      await hfRequest('https://example/x', { token: 'hf_secret' })
      const secondHeaders = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<
        string,
        string
      >
      expect(secondHeaders.Authorization).toBe('Bearer hf_secret')
    })
  })

  describe('searchHuggingFaceModels signal forwarding', () => {
    it('forwards AbortSignal to fetch', async () => {
      const controller = new AbortController()
      const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)

      await searchHuggingFaceModels('q', 5, { signal: controller.signal })

      const init = fetchMock.mock.calls[0][1] as RequestInit
      expect(init.signal).toBe(controller.signal)
    })
  })
})
