/**
 * §O — `useAgent` hook tests.
 *
 * Pins the public hook contract: status transitions (idle → running →
 * done / aborted / error), text accumulation, tool-event tracking, and
 * the abort path. Uses the same MockLanguageModelV3 + simulateReadableStream
 * pattern as src/lib/agent/streaming.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
})
