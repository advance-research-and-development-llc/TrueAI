/**
 * Tests for the native (Android) path of `native/llama`. Mirrors the
 * mock-and-reimport dance used in `secure-storage.android.test.ts`:
 * we mock `./platform` to look Android with the `Llama` plugin
 * available, mock `@capacitor/core`'s `registerPlugin` so we can
 * intercept the calls the JS shim makes, then `vi.resetModules()` and
 * re-import the module under test so the mocked plugin proxy is the
 * one wired up.
 *
 * Why these tests matter: PR 4 will swap the JS shim's caller from
 * dormant test-only code to the AI-SDK `local-native` provider, and a
 * silent regression in argument shape (e.g. `nCtx` vs `n_ctx`) would
 * surface only on a real device. Locking the wire format in vitest
 * keeps the integration cheap to refactor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./platform', () => ({
  isNative: () => true,
  isAndroid: () => true,
  isIOS: () => false,
  getPlatform: () => 'android',
  isPluginAvailable: () => true,
}))

const loadModelMock = vi.fn()
const unloadModelMock = vi.fn()
const isLoadedMock = vi.fn()
const completeMock = vi.fn()
const streamCompleteMock = vi.fn()
const abortStreamMock = vi.fn()
const addListenerMock = vi.fn()

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    loadModel: (...args: unknown[]) => loadModelMock(...args),
    unloadModel: (...args: unknown[]) => unloadModelMock(...args),
    isLoaded: (...args: unknown[]) => isLoadedMock(...args),
    complete: (...args: unknown[]) => completeMock(...args),
    streamComplete: (...args: unknown[]) => streamCompleteMock(...args),
    abortStream: (...args: unknown[]) => abortStreamMock(...args),
    addListener: (...args: unknown[]) => addListenerMock(...args),
  }),
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    isPluginAvailable: () => true,
  },
}))

beforeEach(() => {
  loadModelMock.mockReset()
  unloadModelMock.mockReset()
  isLoadedMock.mockReset()
  completeMock.mockReset()
  streamCompleteMock.mockReset()
  abortStreamMock.mockReset()
  addListenerMock.mockReset()
  vi.resetModules()
})

describe('native/llama (Android paths)', () => {
  it('isAvailable is true when running on Android with the plugin registered', async () => {
    const { llama } = await import('./llama')
    expect(llama.isAvailable()).toBe(true)
  })

  it('loadModel forwards options verbatim to the Capacitor plugin', async () => {
    loadModelMock.mockResolvedValueOnce({
      loaded: true,
      modelPath: '/data/models/test.gguf',
    })
    const { llama } = await import('./llama')
    const result = await llama.loadModel({
      modelPath: '/data/models/test.gguf',
      nCtx: 4096,
      nThreads: 8,
      nGpuLayers: 16,
    })
    expect(loadModelMock).toHaveBeenCalledWith({
      modelPath: '/data/models/test.gguf',
      nCtx: 4096,
      nThreads: 8,
      nGpuLayers: 16,
    })
    expect(result.loaded).toBe(true)
  })

  it('loadModel rejects without calling the plugin when modelPath is empty', async () => {
    const { llama } = await import('./llama')
    await expect(
      // @ts-expect-error testing invalid input
      llama.loadModel({ modelPath: '' }),
    ).rejects.toThrow(/modelPath is required/)
    expect(loadModelMock).not.toHaveBeenCalled()
  })

  it('isLoaded unwraps {loaded} into a boolean', async () => {
    isLoadedMock.mockResolvedValueOnce({ loaded: true })
    const { llama } = await import('./llama')
    await expect(llama.isLoaded()).resolves.toBe(true)
  })

  it('isLoaded swallows plugin errors and returns false', async () => {
    isLoadedMock.mockRejectedValueOnce(new Error('boom'))
    const { llama } = await import('./llama')
    await expect(llama.isLoaded()).resolves.toBe(false)
  })

  it('unloadModel forwards to the plugin and returns the result', async () => {
    unloadModelMock.mockResolvedValueOnce({ loaded: false })
    const { llama } = await import('./llama')
    const result = await llama.unloadModel()
    expect(unloadModelMock).toHaveBeenCalledTimes(1)
    expect(result.loaded).toBe(false)
  })

  it('complete forwards prompt + sampling options verbatim', async () => {
    completeMock.mockResolvedValueOnce({ text: 'pong', finishReason: 'stop' })
    const { llama } = await import('./llama')
    const result = await llama.complete({
      prompt: 'ping',
      nPredict: 32,
      temperature: 0.7,
      topP: 0.9,
      topK: 50,
      minP: 0.1,
      repeatPenalty: 1.2,
    })
    expect(completeMock).toHaveBeenCalledWith({
      prompt: 'ping',
      nPredict: 32,
      temperature: 0.7,
      topP: 0.9,
      topK: 50,
      minP: 0.1,
      repeatPenalty: 1.2,
    })
    expect(result.text).toBe('pong')
    expect(result.finishReason).toBe('stop')
  })

  it('complete rejects without calling the plugin when prompt is missing', async () => {
    const { llama } = await import('./llama')
    await expect(
      // @ts-expect-error testing invalid input
      llama.complete({}),
    ).rejects.toThrow(/prompt is required/)
    expect(completeMock).not.toHaveBeenCalled()
  })

  it('propagates ENGINE_UNAVAILABLE-shaped rejections from the plugin', async () => {
    // The Java side rejects with code "ENGINE_UNAVAILABLE" when the JNI
    // .so was not compiled into the APK. Capacitor surfaces that as an
    // Error whose `code` property is the rejection code. The shim must
    // pass that through unchanged so callers can branch on it.
    const err = Object.assign(
      new Error('Native llama runtime not available in this build'),
      { code: 'ENGINE_UNAVAILABLE' },
    )
    loadModelMock.mockRejectedValueOnce(err)
    const { llama } = await import('./llama')
    await expect(
      llama.loadModel({ modelPath: '/data/models/x.gguf' }),
    ).rejects.toMatchObject({ code: 'ENGINE_UNAVAILABLE' })
  })
})

describe('native/llama (Android, plugin unregistered)', () => {
  it('isAvailable is false when isPluginAvailable returns false', async () => {
    vi.resetModules()
    vi.doMock('./platform', () => ({
      isNative: () => true,
      isAndroid: () => true,
      isIOS: () => false,
      getPlatform: () => 'android',
      isPluginAvailable: () => false,
    }))
    const { llama } = await import('./llama')
    expect(llama.isAvailable()).toBe(false)
    await expect(
      llama.loadModel({ modelPath: '/x' }),
    ).rejects.toMatchObject({ code: 'ENGINE_UNAVAILABLE' })
    vi.doUnmock('./platform')
  })
})

describe('native/llama streaming (Android paths)', () => {
  it('streamComplete subscribes before invoking the JNI start, and routes piece + done events', async () => {
    type Listener = (e: unknown) => void
    let capturedEvent: string | null = null
    let capturedListener: Listener | null = null
    const removeMock = vi.fn(async () => {})
    addListenerMock.mockImplementation(async (event: string, cb: Listener) => {
      capturedEvent = event
      capturedListener = cb
      return { remove: removeMock }
    })
    streamCompleteMock.mockImplementation(async (opts: { streamId: string }) => ({
      streamId: opts.streamId,
    }))

    const { llama } = await import('./llama')
    const events: unknown[] = []
    const handle = await llama.streamComplete(
      { prompt: 'hi there', nPredict: 8, temperature: 0.7 },
      (e) => events.push(e),
    )

    // Listener registered with the per-stream event name BEFORE the JNI
    // start call returned (otherwise the first emitted token could be
    // dropped).
    expect(addListenerMock).toHaveBeenCalledTimes(1)
    expect(capturedEvent).toBe(`llamaToken-${handle.streamId}`)
    expect(addListenerMock.mock.invocationCallOrder[0]).toBeLessThan(
      streamCompleteMock.mock.invocationCallOrder[0],
    )
    // streamId must be embedded in the JNI args so the C++ side can
    // tag its notifyListeners frames with the matching channel.
    expect(streamCompleteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'hi there',
        nPredict: 8,
        temperature: 0.7,
        streamId: handle.streamId,
      }),
    )

    // Drive a couple of token frames followed by the terminal done.
    capturedListener!({ piece: 'he', currentText: 'he' })
    capturedListener!({ piece: 'llo', currentText: 'hello' })
    capturedListener!({ done: true, finishReason: 'stop' })

    expect(events).toEqual([
      { piece: 'he', currentText: 'he' },
      { piece: 'llo', currentText: 'hello' },
      { done: true, finishReason: 'stop' },
    ])

    // Listener handle is detached after the terminal frame so a stale
    // late event from the JNI side cannot invoke a stale callback.
    expect(removeMock).toHaveBeenCalledTimes(1)
  })

  it('streamComplete detaches the listener and rethrows if the JNI start call rejects', async () => {
    const removeMock = vi.fn(async () => {})
    addListenerMock.mockResolvedValueOnce({ remove: removeMock })
    streamCompleteMock.mockRejectedValueOnce(
      Object.assign(new Error('no model loaded'), { code: 'NO_MODEL_LOADED' }),
    )
    const { llama } = await import('./llama')
    await expect(
      llama.streamComplete({ prompt: 'p' }, () => {}),
    ).rejects.toMatchObject({ code: 'NO_MODEL_LOADED' })
    expect(removeMock).toHaveBeenCalledTimes(1)
  })

  it('streamComplete rejects without subscribing when prompt is missing', async () => {
    const { llama } = await import('./llama')
    await expect(
      // @ts-expect-error testing invalid input
      llama.streamComplete({}, () => {}),
    ).rejects.toThrow(/prompt is required/)
    expect(addListenerMock).not.toHaveBeenCalled()
    expect(streamCompleteMock).not.toHaveBeenCalled()
  })

  it('streamComplete rejects when no onEvent callback is supplied', async () => {
    const { llama } = await import('./llama')
    await expect(
      // @ts-expect-error testing invalid input
      llama.streamComplete({ prompt: 'p' }),
    ).rejects.toThrow(/onEvent callback is required/)
    expect(addListenerMock).not.toHaveBeenCalled()
  })

  it('handle.abort() forwards the streamId to abortStream and the listener detaches on the eventual terminal frame', async () => {
    type Listener = (e: unknown) => void
    let capturedListener: Listener | null = null
    const removeMock = vi.fn(async () => {})
    addListenerMock.mockImplementation(async (_event: string, cb: Listener) => {
      capturedListener = cb
      return { remove: removeMock }
    })
    streamCompleteMock.mockResolvedValueOnce({ streamId: 'unused' })
    abortStreamMock.mockResolvedValueOnce(undefined)

    const { llama } = await import('./llama')
    const handle = await llama.streamComplete({ prompt: 'p' }, () => {})

    // First emit one piece, then abort, then the terminal aborted frame.
    capturedListener!({ piece: 'a', currentText: 'a' })
    await handle.abort()
    expect(abortStreamMock).toHaveBeenCalledWith({ streamId: handle.streamId })
    // abort() itself must NOT detach — the JNI side will still send a
    // terminal frame; if we detached early we'd drop the cancel ack.
    expect(removeMock).not.toHaveBeenCalled()
    capturedListener!({ done: true, finishReason: 'aborted' })
    expect(removeMock).toHaveBeenCalledTimes(1)
  })

  it('streamComplete generates unique streamIds across concurrent calls', async () => {
    addListenerMock.mockResolvedValue({ remove: vi.fn() })
    streamCompleteMock.mockImplementation(async (opts: { streamId: string }) => ({
      streamId: opts.streamId,
    }))
    const { llama } = await import('./llama')
    const [h1, h2, h3] = await Promise.all([
      llama.streamComplete({ prompt: 'a' }, () => {}),
      llama.streamComplete({ prompt: 'b' }, () => {}),
      llama.streamComplete({ prompt: 'c' }, () => {}),
    ])
    expect(new Set([h1.streamId, h2.streamId, h3.streamId]).size).toBe(3)
  })
})
