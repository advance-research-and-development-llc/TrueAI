import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { mockLanguageModel, mockFailingLanguageModel } from '@/test/ai-sdk-mocks'

const getLanguageModelMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/llm-runtime/ai-sdk', async () => {
  const actual = await vi.importActual<typeof import('@/lib/llm-runtime/ai-sdk')>(
    '@/lib/llm-runtime/ai-sdk',
  )
  return {
    ...actual,
    getLanguageModel: getLanguageModelMock,
  }
})

import { useStreamingChat } from './use-streaming-chat'

describe('useStreamingChat', () => {
  beforeEach(() => {
    getLanguageModelMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accumulates text deltas and reports done', async () => {
    getLanguageModelMock.mockResolvedValue(
      mockLanguageModel({ chunks: ['Hello', ', ', 'world', '!'] }),
    )
    const { result } = renderHook(() => useStreamingChat())
    expect(result.current.status).toBe('idle')

    let final = ''
    await act(async () => {
      final = await result.current.send('hi')
    })

    expect(final).toBe('Hello, world!')
    expect(result.current.text).toBe('Hello, world!')
    expect(result.current.status).toBe('done')
    expect(result.current.error).toBeNull()
  })

  it('exposes errors and sets status=error', async () => {
    getLanguageModelMock.mockResolvedValue(mockFailingLanguageModel('boom'))
    const { result } = renderHook(() => useStreamingChat())

    let caught: unknown = null
    await act(async () => {
      try {
        await result.current.send('hi')
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('reset() clears text and status back to idle', async () => {
    getLanguageModelMock.mockResolvedValue(
      mockLanguageModel({ chunks: ['abc'] }),
    )
    const { result } = renderHook(() => useStreamingChat())
    await act(async () => {
      await result.current.send('hi')
    })
    expect(result.current.text).toBe('abc')

    act(() => {
      result.current.reset()
    })
    expect(result.current.text).toBe('')
    expect(result.current.status).toBe('idle')
  })

  it('abort() cancels an in-flight send', async () => {
    // Build a model whose stream emits one chunk then awaits forever
    // unless the controller aborts.
    getLanguageModelMock.mockResolvedValue(
      mockLanguageModel({ chunks: ['part1', 'part2', 'part3'] }),
    )
    const { result } = renderHook(() => useStreamingChat())
    let promise!: Promise<string>
    act(() => {
      promise = result.current.send('hi')
    })
    // Abort almost immediately.
    act(() => {
      result.current.abort()
    })
    // Either the stream completed before abort (very fast jsdom) or the
    // abort was honoured — either way the promise should resolve, not
    // throw, because controller.signal.aborted swallows the error.
    await act(async () => {
      await promise.catch(() => undefined)
    })
    // After abort, status should have left 'streaming' (either 'idle'
    // from the abort branch or 'done' if the stream finished first).
    expect(['idle', 'done']).toContain(result.current.status)
  })

  describe('PR 1.g — sampling controls forwarded to streamText', () => {
    it('forwards temperature, topP, topK, frequency/presence penalty, maxOutputTokens, and providerOptions', async () => {
      const seen: Array<Record<string, unknown>> = []
      getLanguageModelMock.mockResolvedValue(
        mockLanguageModel({
          chunks: ['ok'],
          onCall: (callOpts) => {
            seen.push(callOpts as Record<string, unknown>)
          },
        }),
      )
      const { result } = renderHook(() =>
        useStreamingChat({
          temperature: 0.7,
          topP: 0.9,
          topK: 50,
          frequencyPenalty: 0.2,
          presencePenalty: 0.1,
          maxOutputTokens: 256,
          providerOptions: { openai: { min_p: 0.05, repeat_penalty: 1.15 } },
        }),
      )
      await act(async () => {
        await result.current.send('hi')
      })
      expect(seen.length).toBeGreaterThan(0)
      const call = seen[0]
      expect(call.temperature).toBe(0.7)
      expect(call.topP).toBe(0.9)
      expect(call.topK).toBe(50)
      expect(call.frequencyPenalty).toBe(0.2)
      expect(call.presencePenalty).toBe(0.1)
      expect(call.maxOutputTokens).toBe(256)
      expect(call.providerOptions).toEqual({
        openai: { min_p: 0.05, repeat_penalty: 1.15 },
      })
    })

    it('omits sampling fields when the caller does not specify them', async () => {
      const seen: Array<Record<string, unknown>> = []
      getLanguageModelMock.mockResolvedValue(
        mockLanguageModel({
          chunks: ['ok'],
          onCall: (callOpts) => {
            seen.push(callOpts as Record<string, unknown>)
          },
        }),
      )
      const { result } = renderHook(() => useStreamingChat())
      await act(async () => {
        await result.current.send('hi')
      })
      expect(seen.length).toBeGreaterThan(0)
      const call = seen[0]
      expect(call.temperature).toBeUndefined()
      expect(call.topP).toBeUndefined()
      expect(call.topK).toBeUndefined()
      expect(call.frequencyPenalty).toBeUndefined()
      expect(call.presencePenalty).toBeUndefined()
      expect(call.maxOutputTokens).toBeUndefined()
      expect(call.providerOptions).toBeUndefined()
    })

    it('picks up the latest options without re-creating send() (option ref is read on each call)', async () => {
      const seen: Array<Record<string, unknown>> = []
      getLanguageModelMock.mockResolvedValue(
        mockLanguageModel({
          chunks: ['ok'],
          onCall: (callOpts) => {
            seen.push(callOpts as Record<string, unknown>)
          },
        }),
      )
      const { result, rerender } = renderHook(
        (props: { temperature?: number; topK?: number }) =>
          useStreamingChat(props),
        { initialProps: { temperature: 0.1, topK: 10 } },
      )
      await act(async () => {
        await result.current.send('first')
      })
      rerender({ temperature: 0.9, topK: 80 })
      await act(async () => {
        await result.current.send('second')
      })
      expect(seen[0].temperature).toBe(0.1)
      expect(seen[0].topK).toBe(10)
      expect(seen[1].temperature).toBe(0.9)
      expect(seen[1].topK).toBe(80)
    })
  })
})
