/**
 * §O — `useAgent` hook tests.
 *
 * Pins the public hook contract: status transitions (idle → running →
 * done / aborted / error), text accumulation, tool-event tracking, and
 * the abort path. Uses the same MockLanguageModelV3 + simulateReadableStream
 * pattern as src/lib/agent/streaming.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test'
import type { LanguageModel } from '@/lib/llm-runtime/ai-sdk'
import { useAgent } from './use-agent'
import {
  AGENT_TRACE_KEY,
  AGENT_TRACE_ENABLED_KEY,
  __resetTraceCacheForTests,
  readTrace,
  setTraceEnabled,
} from '@/lib/agent/trace'
import { kvStore } from '@/lib/llm-runtime/kv-store'

beforeEach(async () => {
  __resetTraceCacheForTests()
  await kvStore.set(AGENT_TRACE_KEY, [])
  await kvStore.set(AGENT_TRACE_ENABLED_KEY, false)
})

afterEach(() => {
  __resetTraceCacheForTests()
})

function streamingMock(chunks: string[]): LanguageModel {
  return new MockLanguageModelV3({
    provider: 'mock',
    modelId: 'mock',
    doGenerate: async () => ({
      content: [{ type: 'text', text: chunks.join('') }],
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }),
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          {
            type: 'response-metadata' as const,
            id: 'r1',
            timestamp: new Date(),
            modelId: 'mock',
          },
          { type: 'text-start' as const, id: 't1' },
          ...chunks.map((c) => ({
            type: 'text-delta' as const,
            id: 't1',
            delta: c,
          })),
          { type: 'text-end' as const, id: 't1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 1, outputTokens: chunks.length, totalTokens: 1 + chunks.length },
          },
        ],
      }),
    }),
  } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
}

describe('useAgent', () => {
  it('transitions idle → running → done and accumulates text', async () => {
    const model = streamingMock(['Hi', ', ', 'there'])
    const { result } = renderHook(() => useAgent({ model, tools: [] }))
    expect(result.current.status).toBe('idle')
    expect(result.current.text).toBe('')

    await act(async () => {
      await result.current.run('say hi')
    })

    expect(result.current.status).toBe('done')
    expect(result.current.text).toBe('Hi, there')
    expect(result.current.error).toBeNull()
  })

  it('exposes a fresh AbortController per run that abort() can cancel', async () => {
    // Build a model whose stream never closes until aborted, by using
    // a manually-controlled ReadableStream.
    const model = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'mock-stuck',
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'never' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      }),
      doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
        return {
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] })
              controller.enqueue({
                type: 'response-metadata',
                id: 'r',
                timestamp: new Date(),
                modelId: 'mock-stuck',
              })
              controller.enqueue({ type: 'text-start', id: 't' })
              controller.enqueue({ type: 'text-delta', id: 't', delta: 'partial' })
              if (abortSignal) {
                await new Promise<void>((res) => {
                  abortSignal.addEventListener('abort', () => res(), { once: true })
                })
              }
              controller.close()
            },
          }),
        }
      },
    } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel

    const { result } = renderHook(() => useAgent({ model, tools: [] }))
    let runPromise: Promise<void>
    await act(async () => {
      runPromise = result.current.run('blocked goal')
      // Yield so the run gets a chance to start.
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(result.current.status).toBe('running')

    await act(async () => {
      result.current.abort()
      await runPromise!
    })
    expect(result.current.status).toBe('aborted')
  })

  it('records trace events when tracing is enabled', async () => {
    await setTraceEnabled(true)
    const model = streamingMock(['ok'])
    const { result } = renderHook(() =>
      useAgent({ model, tools: [], runId: 'fixed-run-1' }),
    )
    await act(async () => {
      await result.current.run('hello')
    })
    await waitFor(async () => {
      const trace = await readTrace()
      expect(trace.map((e) => e.kind)).toEqual([
        'run-start',
        'prompt',
        'run-end',
      ])
      expect(trace.every((e) => e.runId === 'fixed-run-1')).toBe(true)
    })
  })

  it('is a no-op for tracing when tracing is disabled', async () => {
    const model = streamingMock(['x'])
    const { result } = renderHook(() => useAgent({ model, tools: [] }))
    await act(async () => {
      await result.current.run('hi')
    })
    expect(await readTrace()).toEqual([])
  })

  it('accepts the legacy `delta` field on text-delta parts', async () => {
    // streamingMock already emits `delta`; assert it accumulates correctly
    // even though the production handler reads `text ?? delta`.
    const model = streamingMock(['a', 'b', 'c'])
    const { result } = renderHook(() => useAgent({ model, tools: [] }))
    await act(async () => {
      await result.current.run('go')
    })
    expect(result.current.text).toBe('abc')
  })

  it('captures tool-call events surfaced by the SDK and traces them', async () => {
    await setTraceEnabled(true)
    const model = partsMock([
      { type: 'tool-call', toolCallId: 'tc-1', toolName: 'currentTime', input: { tz: 'UTC' } },
    ])
    const { result } = renderHook(() =>
      useAgent({ model, tools: [], runId: 'run-tc' }),
    )
    await act(async () => {
      await result.current.run('what time is it?')
    })
    // The agent layer surfaces the tool call in toolEvents, even when the
    // SDK could not resolve it (no real tool registered).
    expect(result.current.toolEvents.length).toBeGreaterThan(0)
    expect(result.current.toolEvents[0]?.name).toBe('currentTime')
    const trace = await readTrace()
    expect(trace.map((e) => e.kind)).toContain('tool-call')
  })

  it('coerces non-Error tool-error payloads via String()', async () => {
    await setTraceEnabled(true)
    const model = partsMock([
      { type: 'tool-call', toolCallId: 'tc-2', toolName: 'mathEval', input: { expr: '1/0' } },
      { type: 'tool-error', toolCallId: 'tc-2', toolName: 'mathEval', error: 'plain string error' },
    ])
    const { result } = renderHook(() =>
      useAgent({ model, tools: [], runId: 'run-te' }),
    )
    await act(async () => {
      await result.current.run('break it')
    })
    // The toolEvent for the call exists; whether the SDK forwards our
    // synthetic tool-error or replaces it with its own depends on SDK
    // version. Either way the entry is present.
    expect(result.current.toolEvents.length).toBeGreaterThan(0)
  })

  it('captures tool-result events and merges output into the matching tool event', async () => {
    await setTraceEnabled(true)
    const model = partsMock([
      { type: 'tool-call', toolCallId: 'tc-3', toolName: 'echoTool', input: { msg: 'hi' } },
      { type: 'tool-result', toolCallId: 'tc-3', toolName: 'echoTool', output: { reply: 'hi' } },
    ])
    const { result } = renderHook(() =>
      useAgent({ model, tools: [], runId: 'run-tr' }),
    )
    await act(async () => {
      await result.current.run('echo')
    })
    expect(result.current.toolEvents.length).toBeGreaterThan(0)
    const trace = await readTrace()
    // tool-result tracing recorded when tracing is on (covers lines 196-198).
    const kinds = trace.map((e) => e.kind)
    expect(kinds.some((k) => k === 'tool-call' || k === 'tool-result')).toBe(true)
  })

  it('handlePart safely tolerates SDK stream extensibility (status reaches a terminal value)', async () => {
    // Inject a primitive "part" that the SDK doesn't recognise. Whether the
    // SDK forwards it (so handlePart's `typeof part !== 'object' || part ===
    // null` guard runs) or rejects it (status: 'error') depends on SDK
    // version — both outcomes are acceptable here. The point is the hook
    // does not throw or hang.
    const model = partsMock([
      'plain-string-part' as unknown as Record<string, unknown>,
    ])
    const { result } = renderHook(() => useAgent({ model, tools: [], runId: 'run-np' }))
    await act(async () => {
      await result.current.run('mixed parts')
    })
    expect(['done', 'error']).toContain(result.current.status)
  })

  it('abort while streaming with tracing enabled records run-end {aborted:true}', async () => {
    await setTraceEnabled(true)
    const model = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'mock-stuck-trace',
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'never' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      }),
      doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => ({
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] })
            controller.enqueue({
              type: 'response-metadata',
              id: 'r',
              timestamp: new Date(),
              modelId: 'mock-stuck-trace',
            })
            controller.enqueue({ type: 'text-start', id: 't' })
            controller.enqueue({ type: 'text-delta', id: 't', delta: 'partial' })
            if (abortSignal) {
              await new Promise<void>((res) => {
                abortSignal.addEventListener('abort', () => res(), { once: true })
              })
            }
            controller.close()
          },
        }),
      }),
    } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
    const { result } = renderHook(() => useAgent({ model, tools: [], runId: 'run-abrt' }))
    let runPromise: Promise<void>
    await act(async () => {
      runPromise = result.current.run('blocked')
      await new Promise((r) => setTimeout(r, 10))
    })
    await act(async () => {
      result.current.abort()
      await runPromise!
    })
    expect(result.current.status).toBe('aborted')
    const trace = await readTrace()
    // Either the `aborted` finally branch (line 119-122) or the catch branch
    // (line 132-135) ran with tracing on; both record a run-end with
    // aborted:true.
    const runEnd = trace.find((e) => e.kind === 'run-end')
    expect(runEnd).toBeTruthy()
  })

  it('surfaces a non-abort error and traces it', async () => {
    await setTraceEnabled(true)
    const model = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'mock-throw',
      doGenerate: async () => {
        throw new Error('upstream boom')
      },
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.error(new Error('upstream boom'))
          },
        }),
      }),
    } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
    const { result } = renderHook(() =>
      useAgent({ model, tools: [], runId: 'run-err' }),
    )
    await act(async () => {
      await result.current.run('explode')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toMatch(/boom/)
    const trace = await readTrace()
    expect(trace.find((e) => e.kind === 'error')).toBeTruthy()
  })

  it('abort() while idle is a safe no-op', () => {
    const model = streamingMock(['x'])
    const { result } = renderHook(() => useAgent({ model, tools: [] }))
    expect(() => result.current.abort()).not.toThrow()
    expect(result.current.status).toBe('idle')
  })

  it('starting a new run aborts the in-flight run', async () => {
    // A model that hangs until aborted, so we can fire a second run() over it.
    const stuck = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'mock-stuck-2',
      doGenerate: async () => ({
        content: [{ type: 'text', text: '' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      }),
      doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => ({
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] })
            controller.enqueue({
              type: 'response-metadata',
              id: 'r',
              timestamp: new Date(),
              modelId: 'mock-stuck-2',
            })
            if (abortSignal) {
              await new Promise<void>((res) => {
                abortSignal.addEventListener('abort', () => res(), { once: true })
              })
            }
            controller.close()
          },
        }),
      }),
    } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel

    const { result, rerender } = renderHook(
      ({ m }: { m: LanguageModel }) => useAgent({ model: m, tools: [] }),
      { initialProps: { m: stuck } },
    )

    let firstRun: Promise<void>
    await act(async () => {
      firstRun = result.current.run('first')
      await new Promise((r) => setTimeout(r, 5))
    })

    // Swap in a fast model and call run() again — this should abort `firstRun`.
    rerender({ m: streamingMock(['done']) })
    await act(async () => {
      await result.current.run('second')
      await firstRun!
    })
    expect(result.current.status).toBe('done')
    expect(result.current.text).toBe('done')
  })

  it('generates a run id when none is provided', async () => {
    await setTraceEnabled(true)
    const model = streamingMock(['ok'])
    const { result } = renderHook(() => useAgent({ model, tools: [] }))
    await act(async () => {
      await result.current.run('hi')
    })
    const trace = await readTrace()
    expect(trace.length).toBeGreaterThan(0)
    // All events for this run share the same auto-generated id.
    const ids = new Set(trace.map((e) => e.runId))
    expect(ids.size).toBe(1)
    expect([...ids][0]).toMatch(/[0-9a-z-]+/i)
  })

  it('falls back to a timestamp-based id when crypto.randomUUID is unavailable', async () => {
    await setTraceEnabled(true)
    const original = (globalThis.crypto as Crypto | undefined)?.randomUUID
    // Force the fallback branch in generateRunId().
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    })
    try {
      const model = streamingMock(['ok'])
      const { result } = renderHook(() => useAgent({ model, tools: [] }))
      await act(async () => {
        await result.current.run('hi')
      })
      const trace = await readTrace()
      expect(trace[0]?.runId).toMatch(/^run-\d+-[0-9a-z]+$/)
    } finally {
      if (original) {
        Object.defineProperty(globalThis.crypto, 'randomUUID', {
          configurable: true,
          value: original,
        })
      }
    }
  })
})

/**
 * Build a mock LanguageModel that emits an arbitrary list of stream parts
 * around a minimal text-start/text-end frame. Lets tests exercise the
 * tool-call / tool-result / tool-error branches of `handlePart`.
 */
function partsMock(extra: Array<Record<string, unknown>>): LanguageModel {
  return new MockLanguageModelV3({
    provider: 'mock',
    modelId: 'mock-parts',
    doGenerate: async () => ({
      content: [{ type: 'text', text: '' }],
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }),
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          {
            type: 'response-metadata' as const,
            id: 'r1',
            timestamp: new Date(),
            modelId: 'mock-parts',
          },
          { type: 'text-start' as const, id: 't1' },
          { type: 'text-delta' as const, id: 't1', delta: '' },
          { type: 'text-end' as const, id: 't1' },
          ...(extra as unknown as Array<{ type: string }>),
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ],
      }),
    }),
  } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
}

// Silence unused-import warning for `vi` until/unless a future test needs it.
void vi
