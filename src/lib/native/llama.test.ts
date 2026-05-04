/**
 * Web/jsdom path tests for `native/llama`. Mirrors the
 * `secure-storage.test.ts` pattern: jsdom is not "native" so the shim
 * must reject every operation with `ENGINE_UNAVAILABLE` and report
 * `isAvailable() === false` without throwing.
 */

import { describe, it, expect, vi } from 'vitest'
import { llama } from './llama'

describe('native/llama (web fallback)', () => {
  it('isAvailable returns false on web', () => {
    expect(llama.isAvailable()).toBe(false)
  })

  it('isLoaded resolves to false (does not throw) on web', async () => {
    await expect(llama.isLoaded()).resolves.toBe(false)
  })

  it('loadModel rejects with ENGINE_UNAVAILABLE on web', async () => {
    await expect(
      llama.loadModel({ modelPath: '/tmp/whatever.gguf' }),
    ).rejects.toMatchObject({ code: 'ENGINE_UNAVAILABLE' })
  })

  it('unloadModel rejects with ENGINE_UNAVAILABLE on web', async () => {
    await expect(llama.unloadModel()).rejects.toMatchObject({
      code: 'ENGINE_UNAVAILABLE',
    })
  })

  it('complete rejects with ENGINE_UNAVAILABLE on web', async () => {
    await expect(
      llama.complete({ prompt: 'hello' }),
    ).rejects.toMatchObject({ code: 'ENGINE_UNAVAILABLE' })
  })

  it('streamComplete rejects with ENGINE_UNAVAILABLE on web (no listener registered)', async () => {
    const onEvent = vi.fn()
    await expect(
      llama.streamComplete({ prompt: 'hello' }, onEvent),
    ).rejects.toMatchObject({ code: 'ENGINE_UNAVAILABLE' })
    expect(onEvent).not.toHaveBeenCalled()
  })
})
