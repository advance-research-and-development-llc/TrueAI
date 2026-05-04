/**
 * Tests for the AI-SDK `local-native` provider adapter.
 *
 * Two distinct paths exercised:
 *   1. Native available — calls flow into the Capacitor `Llama` plugin
 *      (mocked via an injected `llamaShim`).
 *   2. Native unavailable — calls transparently delegate to the
 *      `local-wasm` (wllama) fallback so the user never sees a "native
 *      runtime not available" error in normal use.
 *
 * The streaming-event format mirrors the JNI emission shape locked in
 * `llama.android.test.ts`; if the C++ side ever changes the payload,
 * those tests catch the wire change and these tests catch the AI-SDK
 * frame-translation drift.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LanguageModelV3, LanguageModelV3StreamPart } from '@ai-sdk/provider'

import {
  __resetLocalNativeForTests,
  createLocalNativeModel,
} from './local-native-provider'
import type {
  LlamaApi,
  LlamaCompleteOptions,
  LlamaStreamEvent,
  LlamaStreamHandle,
  LlamaStreamOptions,
} from '@/lib/native/llama'

interface MockShim extends LlamaApi {
  __emitStream: (events: LlamaStreamEvent[]) => Promise<void>
  __lastStreamOptions: LlamaStreamOptions | null
  __lastCompleteOptions: LlamaCompleteOptions | null
  __loadCalls: Array<{ modelPath: string; nCtx?: number; nThreads?: number; nGpuLayers?: number }>
}

function makeShim(opts: { available?: boolean } = {}): MockShim {
  const available = opts.available ?? true
  let pendingListener: ((e: LlamaStreamEvent) => void) | null = null
  const abortMock = vi.fn(async () => {})
  const loadCalls: MockShim['loadCalls'] = []
  const shim = {
    isAvailable: () => available,
    async loadModel(o) {
      loadCalls.push({
        modelPath: o.modelPath,
        nCtx: o.nCtx,
        nThreads: o.nThreads,
        nGpuLayers: o.nGpuLayers,
      })
      return { loaded: true, modelPath: o.modelPath }
    },
    async unloadModel() {
      return { loaded: false }
    },
    async isLoaded() {
      return true
    },
    async complete(o) {
      shim.__lastCompleteOptions = o
      return { text: 'native one-shot reply', finishReason: 'stop' }
    },
    async streamComplete(
      o: LlamaStreamOptions,
      onEvent: (e: LlamaStreamEvent) => void,
    ): Promise<LlamaStreamHandle> {
      shim.__lastStreamOptions = o
      pendingListener = onEvent
      return { streamId: 'test-stream', abort: abortMock }
    },
    __emitStream: async (events: LlamaStreamEvent[]) => {
      if (!pendingListener) throw new Error('no stream in progress')
      for (const e of events) pendingListener(e)
    },
    __lastStreamOptions: null,
    __lastCompleteOptions: null,
    __loadCalls: loadCalls,
  } as unknown as MockShim & {
    loadCalls: MockShim['__loadCalls']
  }
  // Expose abort mock on the shim for assertions.
  ;(shim as MockShim & { __abortMock: typeof abortMock }).__abortMock = abortMock
  return shim
}

async function readAllParts(
  result: { stream: ReadableStream<LanguageModelV3StreamPart> },
): Promise<LanguageModelV3StreamPart[]> {
  const out: LanguageModelV3StreamPart[] = []
  const reader = result.stream.getReader()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    out.push(value)
  }
  return out
}

beforeEach(() => {
  __resetLocalNativeForTests()
})

afterEach(() => {
  __resetLocalNativeForTests()
})

describe('local-native-provider (native available)', () => {
  it('rejects doGenerate when no modelPath is configured (and no fallback present)', async () => {
    const shim = makeShim()
    const fallback: LanguageModelV3 = {
      specificationVersion: 'v3',
      provider: 'noop',
      modelId: 'm',
      supportedUrls: {},
      doGenerate: async () => {
        throw new Error('fallback should not be reached')
      },
      doStream: async () => {
        throw new Error('fallback should not be reached')
      },
    }
    const model = createLocalNativeModel({
      modelPath: '',
      modelId: 'm',
      llamaShim: shim,
      fallback,
    })
    await expect(
      model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      }),
    ).rejects.toThrow(/no model is configured/i)
  })

  it('loads the model lazily on first call and reuses the load on subsequent calls with same config', async () => {
    const shim = makeShim()
    const model = createLocalNativeModel({
      modelPath: '/data/models/m.gguf',
      modelId: 'm',
      contextSize: 4096,
      nThreads: 6,
      nGpuLayers: 0,
      llamaShim: shim,
    })
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'again' }] }],
    })
    expect(shim.__loadCalls).toEqual([
      { modelPath: '/data/models/m.gguf', nCtx: 4096, nThreads: 6, nGpuLayers: 0 },
    ])
  })

  it('forwards prompt + sampling options to native complete and returns the text', async () => {
    const shim = makeShim()
    const model = createLocalNativeModel({
      modelPath: '/p.gguf',
      modelId: 'm',
      maxOutputTokens: 32,
      defaultSampling: { temperature: 0.5, topP: 0.9, topK: 40, minP: 0.05, repeatPenalty: 1.1 },
      llamaShim: shim,
    })
    const result = await model.doGenerate({
      prompt: [
        { role: 'system', content: 'be terse' },
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      ],
      maxOutputTokens: 16, // per-call wins
      temperature: 0.2, // per-call wins
    })
    expect(shim.__lastCompleteOptions).toMatchObject({
      nPredict: 16,
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      minP: 0.05,
      repeatPenalty: 1.1,
    })
    expect(shim.__lastCompleteOptions?.prompt).toContain('be terse')
    expect(shim.__lastCompleteOptions?.prompt).toContain('User: hi')
    expect(shim.__lastCompleteOptions?.prompt).toMatch(/Assistant:\s*$/)
    expect(result.content).toEqual([{ type: 'text', text: 'native one-shot reply' }])
    expect(result.finishReason.unified).toBe('stop')
  })

  it('emits stream-start, text-start, deltas, text-end and finish frames in order', async () => {
    const shim = makeShim()
    const model = createLocalNativeModel({
      modelPath: '/p.gguf',
      modelId: 'm',
      llamaShim: shim,
    })
    const streamResult = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    // Drain in a microtask after the start() body has registered the
    // listener via streamComplete().
    await Promise.resolve()
    await shim.__emitStream([
      { piece: 'he', currentText: 'he' },
      { piece: 'llo', currentText: 'hello' },
      { done: true, finishReason: 'stop' },
    ])
    const parts = await readAllParts(streamResult)
    const types = parts.map((p) => p.type)
    expect(types).toEqual([
      'stream-start',
      'text-start',
      'text-delta',
      'text-delta',
      'text-end',
      'finish',
    ])
    const deltas = parts.filter((p): p is Extract<LanguageModelV3StreamPart, { type: 'text-delta' }> => p.type === 'text-delta')
    expect(deltas.map((d) => d.delta)).toEqual(['he', 'llo'])
    const finish = parts[parts.length - 1] as Extract<LanguageModelV3StreamPart, { type: 'finish' }>
    expect(finish.finishReason.unified).toBe('stop')
  })

  it('falls back to currentText delta when piece is empty (forward-compat with currentText-only emissions)', async () => {
    const shim = makeShim()
    const model = createLocalNativeModel({
      modelPath: '/p.gguf',
      modelId: 'm',
      llamaShim: shim,
    })
    const streamResult = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    await Promise.resolve()
    await shim.__emitStream([
      { piece: '', currentText: 'he' },
      { piece: '', currentText: 'hello' },
      { done: true, finishReason: 'stop' },
    ])
    const parts = await readAllParts(streamResult)
    const deltas = parts.filter((p): p is Extract<LanguageModelV3StreamPart, { type: 'text-delta' }> => p.type === 'text-delta')
    expect(deltas.map((d) => d.delta)).toEqual(['he', 'llo'])
  })

  it('translates a finishReason=error event into a stream error frame followed by finish', async () => {
    const shim = makeShim()
    const model = createLocalNativeModel({
      modelPath: '/p.gguf',
      modelId: 'm',
      llamaShim: shim,
    })
    const streamResult = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    await Promise.resolve()
    await shim.__emitStream([
      { done: true, finishReason: 'error', errorMessage: 'CUDA OOM' },
    ])
    const parts = await readAllParts(streamResult)
    const errorPart = parts.find((p) => p.type === 'error') as
      | Extract<LanguageModelV3StreamPart, { type: 'error' }>
      | undefined
    expect(errorPart).toBeDefined()
    expect((errorPart!.error as Error).message).toMatch(/CUDA OOM/)
    const finish = parts[parts.length - 1] as Extract<LanguageModelV3StreamPart, { type: 'finish' }>
    expect(finish.finishReason.unified).toBe('error')
  })

  it('aborts the native stream when the caller-supplied AbortSignal fires', async () => {
    const shim = makeShim()
    const abortMock = (shim as unknown as { __abortMock: ReturnType<typeof vi.fn> }).__abortMock
    const model = createLocalNativeModel({
      modelPath: '/p.gguf',
      modelId: 'm',
      llamaShim: shim,
    })
    const ac = new AbortController()
    const streamResult = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      abortSignal: ac.signal,
    })
    await Promise.resolve()
    await shim.__emitStream([{ piece: 'a', currentText: 'a' }])
    ac.abort()
    // give the abort callback a chance to fire
    await Promise.resolve()
    expect(abortMock).toHaveBeenCalledTimes(1)
    // JNI side still emits the terminal frame.
    await shim.__emitStream([{ done: true, finishReason: 'aborted' }])
    const parts = await readAllParts(streamResult)
    const finish = parts[parts.length - 1] as Extract<LanguageModelV3StreamPart, { type: 'finish' }>
    expect(finish.finishReason.raw).toBe('aborted')
  })

  it('returns an immediately-closed aborted stream when AbortSignal is already fired', async () => {
    const shim = makeShim()
    const model = createLocalNativeModel({
      modelPath: '/p.gguf',
      modelId: 'm',
      llamaShim: shim,
    })
    const ac = new AbortController()
    ac.abort()
    const streamResult = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      abortSignal: ac.signal,
    })
    const parts = await readAllParts(streamResult)
    expect(parts.map((p) => p.type)).toEqual(['stream-start', 'finish'])
  })

  it('reloads the native model when modelPath changes between calls', async () => {
    const shim = makeShim()
    const m1 = createLocalNativeModel({
      modelPath: '/a.gguf',
      modelId: 'a',
      llamaShim: shim,
    })
    await m1.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'x' }] }],
    })
    const m2 = createLocalNativeModel({
      modelPath: '/b.gguf',
      modelId: 'b',
      llamaShim: shim,
    })
    await m2.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'y' }] }],
    })
    expect(shim.__loadCalls.map((c) => c.modelPath)).toEqual([
      '/a.gguf',
      '/b.gguf',
    ])
  })

  it('drops tool messages and image parts with warnings (matches local-wasm contract)', async () => {
    const shim = makeShim()
    const model = createLocalNativeModel({
      modelPath: '/p.gguf',
      modelId: 'm',
      llamaShim: shim,
    })
    const result = await model.doGenerate({
      prompt: [
        {
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: 't', toolName: 'x', output: { type: 'text', value: 'ok' } }],
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'see image' },
            // @ts-expect-error file part shape varies across @ai-sdk/provider versions
            { type: 'file', data: 'x', mediaType: 'image/png' },
          ],
        },
      ],
    })
    expect(result.warnings?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})

describe('local-native-provider (native unavailable → fallback)', () => {
  it('delegates doGenerate to the explicit fallback', async () => {
    const shim = makeShim({ available: false })
    const fallbackResult = {
      content: [{ type: 'text', text: 'from fallback' } as const],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: {
        inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: undefined, text: undefined, reasoning: undefined },
      },
      warnings: [],
    }
    const fallback: LanguageModelV3 = {
      specificationVersion: 'v3',
      provider: 'noop',
      modelId: 'm',
      supportedUrls: {},
      doGenerate: vi.fn(async () => fallbackResult),
      doStream: vi.fn(async () => ({
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          start(c) { c.close() },
        }),
      })),
    }
    const model = createLocalNativeModel({
      modelPath: '/p.gguf',
      modelId: 'm',
      llamaShim: shim,
      fallback,
    })
    const r = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    expect(r).toBe(fallbackResult)
    expect(fallback.doGenerate).toHaveBeenCalledTimes(1)
  })

  it('delegates doStream to the explicit fallback', async () => {
    const shim = makeShim({ available: false })
    const fallback: LanguageModelV3 = {
      specificationVersion: 'v3',
      provider: 'noop',
      modelId: 'm',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn(async () => ({
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          start(c) {
            c.enqueue({ type: 'stream-start', warnings: [] })
            c.close()
          },
        }),
      })),
    }
    const model = createLocalNativeModel({
      modelPath: '/p.gguf',
      modelId: 'm',
      llamaShim: shim,
      fallback,
    })
    const result = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    const parts = await readAllParts(result)
    expect(parts[0].type).toBe('stream-start')
    expect(fallback.doStream).toHaveBeenCalledTimes(1)
  })

  it('builds an automatic local-wasm fallback when none is provided', async () => {
    const shim = makeShim({ available: false })
    const model = createLocalNativeModel({
      modelPath: '', // empty so the wllama provider's "no model source" check fires
      modelId: 'm',
      llamaShim: shim,
    })
    // local-wasm provider rejects with a clear error when modelSource
    // is empty — that's the surface we expect web users to hit.
    await expect(
      model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      }),
    ).rejects.toThrow(/no model source is configured/i)
  })
})
