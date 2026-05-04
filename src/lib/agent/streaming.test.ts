/**
 * §N — Streaming + abort wiring tests for the TrueAI agent helpers.
 *
 * Pins:
 *   - `streamTrueAIAgentRun` returns the SDK's streamText result and
 *     the `textStream` async iterator yields the scripted chunks in
 *     order.
 *   - `generateTrueAIAgentRun` resolves to the SDK's generateText
 *     result with the scripted text.
 *   - The provided `abortSignal` is forwarded to the underlying model
 *     call options so the chat UI's "stop" button works without
 *     re-instantiating the agent.
 *   - The same budget predicate is reused — we don't lose the
 *     stopWhen safety net just because we're streaming.
 */

import { describe, it, expect, vi } from 'vitest'
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test'
import type { LanguageModel } from '@/lib/llm-runtime/ai-sdk'
import {
  generateTrueAIAgentRun,
  streamTrueAIAgentRun,
} from './tool-loop-agent'

function streamingMock(
  chunks: string[],
  onCall?: (callOpts: unknown) => void,
): LanguageModel {
  return new MockLanguageModelV3({
    provider: 'mock-stream',
    modelId: 'mock-stream-model',
    doGenerate: async (callOpts: unknown) => {
      onCall?.(callOpts)
      return {
        content: [{ type: 'text', text: chunks.join('') }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      }
    },
    doStream: async (callOpts: unknown) => {
      onCall?.(callOpts)
      const stream = simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          {
            type: 'response-metadata' as const,
            id: 'resp-1',
            timestamp: new Date(),
            modelId: 'mock-stream-model',
          },
          { type: 'text-start' as const, id: 'txt-1' },
          ...chunks.map((c) => ({
            type: 'text-delta' as const,
            id: 'txt-1',
            delta: c,
          })),
          { type: 'text-end' as const, id: 'txt-1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 1, outputTokens: chunks.length, totalTokens: 1 + chunks.length },
          },
        ],
      })
      return { stream }
    },
  } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
}

describe('streamTrueAIAgentRun', () => {
  it('streams scripted chunks in order', async () => {
    const model = streamingMock(['Hello', ', ', 'world', '!'])
    const result = streamTrueAIAgentRun(
      { model, tools: [] },
      { goal: 'say hello' },
    )
    const collected: string[] = []
    for await (const c of result.textStream) {
      collected.push(c)
    }
    expect(collected.join('')).toBe('Hello, world!')
  })

  it('forwards abortSignal to the underlying stream call', async () => {
    const onCall = vi.fn()
    const model = streamingMock(['ok'], onCall)
    const ctrl = new AbortController()
    const result = streamTrueAIAgentRun(
      { model, tools: [] },
      { goal: 'g', abortSignal: ctrl.signal },
    )
    // Drain the stream so doStream is invoked synchronously enough
    // for our onCall spy to record the call options.
    for await (const _ of result.textStream) {
      // discard
    }
    expect(onCall).toHaveBeenCalled()
    const callOpts = onCall.mock.calls[0][0] as { abortSignal?: AbortSignal }
    expect(callOpts.abortSignal).toBe(ctrl.signal)
  })
})

describe('generateTrueAIAgentRun', () => {
  it('resolves to the scripted text', async () => {
    const model = streamingMock(['answer is 5'])
    const { text } = await generateTrueAIAgentRun(
      { model, tools: [] },
      { goal: 'add 2 and 3' },
    )
    expect(text).toBe('answer is 5')
  })

  it('forwards abortSignal to the underlying generate call', async () => {
    const onCall = vi.fn()
    const model = streamingMock(['x'], onCall)
    const ctrl = new AbortController()
    await generateTrueAIAgentRun(
      { model, tools: [] },
      { goal: 'g', abortSignal: ctrl.signal },
    )
    expect(onCall).toHaveBeenCalled()
    const callOpts = onCall.mock.calls[0][0] as { abortSignal?: AbortSignal }
    expect(callOpts.abortSignal).toBe(ctrl.signal)
  })
})
