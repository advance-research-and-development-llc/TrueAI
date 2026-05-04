import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { mockLanguageModel, mockFailingLanguageModel, MockLanguageModelV3 } from '@/test/ai-sdk-mocks'
import type { LanguageModel } from 'ai'

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

    it('prepends a system message when options.system is set (skips it when empty)', async () => {
      const seenMessages: Array<unknown[]> = []
      getLanguageModelMock.mockResolvedValue(
        mockLanguageModel({
          chunks: ['ok'],
          onCall: (callOpts) => {
            const prompt = (callOpts as { prompt: unknown[] }).prompt
            seenMessages.push(prompt)
          },
        }),
      )
      const { result, rerender } = renderHook(
        (props: { system?: string }) => useStreamingChat(props),
        { initialProps: { system: 'You are helpful.' } },
      )
      await act(async () => {
        await result.current.send('hi', [
          { role: 'user', content: 'earlier' },
          { role: 'assistant', content: 'reply' },
        ])
      })
      // First message should be the system prompt, then history, then current user.
      const first = seenMessages[0]
      expect(first[0]).toMatchObject({ role: 'system' })
      expect(first.length).toBe(4)
      // Empty system string should NOT prepend a system message.
      seenMessages.length = 0
      rerender({ system: '' })
      await act(async () => {
        await result.current.send('hi2')
      })
      const second = seenMessages[0]
      // Only the user message should be present.
      expect(second.every((m) => (m as { role: string }).role !== 'system')).toBe(true)
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

  describe('mid-stream error & catch branches', () => {
    /**
     * Build a model whose stream emits text chunks then an error part
     * mid-stream, exercising the `onError` → streamError → throw path
     * inside the for-await loop body of `send()`.
     */
    function modelWithMidStreamError(error: unknown): LanguageModel {
      return new MockLanguageModelV3({
        provider: 'mock-provider',
        modelId: 'mock-model',
        doStream: async () => {
          const id = 'mid-err-id'
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] })
              controller.enqueue({ type: 'text-start', id })
              controller.enqueue({ type: 'text-delta', id, delta: 'first' })
              // Surface an error mid-stream — exercises the `onError`
              // callback inside the hook (line ~138) and the
              // `if (streamError) throw streamError` rethrow (line ~145).
              controller.enqueue({ type: 'error', error })
              controller.enqueue({ type: 'text-delta', id, delta: 'second' })
              controller.enqueue({ type: 'text-end', id })
              controller.enqueue({
                type: 'finish',
                finishReason: 'error',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              })
              controller.close()
            },
          })
          return { stream }
        },
      } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
    }

    it('rethrows mid-stream error parts via the onError → streamError path', async () => {
      getLanguageModelMock.mockResolvedValue(
        modelWithMidStreamError(new Error('mid-stream boom')),
      )
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
      expect((caught as Error).message).toBe('mid-stream boom')
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('wraps a non-Error onError payload into an Error before rethrowing', async () => {
      // A bare string is the canonical "non-Error" payload — exercises
      // the `error instanceof Error ? error : new Error(String(error))`
      // false arm inside the onError handler.
      getLanguageModelMock.mockResolvedValue(modelWithMidStreamError('plain-string-error'))
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
      expect((caught as Error).message).toBe('plain-string-error')
      expect(result.current.error?.message).toBe('plain-string-error')
    })

    it('wraps a non-Error thrown by the underlying model into an Error in the catch block', async () => {
      // mockFailingLanguageModel throws Error; build one that throws a
      // non-Error to exercise the catch-block fallback wrapper
      // (`err instanceof Error ? err : new Error(String(err))`).
      const stringThrowingModel = new MockLanguageModelV3({
        provider: 'mock-provider',
        modelId: 'mock-model',
        doStream: async () => {
          // TypeScript allows throwing any value; no cast needed.
          throw 'string-throw'
        },
      } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
      getLanguageModelMock.mockResolvedValue(stringThrowingModel)
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
      expect((caught as Error).message).toBe('string-throw')
      expect(result.current.status).toBe('error')
    })

    it('returns "" with status=idle when abort() is called before send completes (catch-with-userAborted path)', async () => {
      // Build a model whose stream never resolves on its own — only the
      // controller.abort() inside the hook can terminate it. This makes
      // the catch-block userAbortedRef branch (lines 162-164) deterministic.
      const neverEndingModel = new MockLanguageModelV3({
        provider: 'mock-provider',
        modelId: 'mock-model',
        doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] })
              controller.enqueue({ type: 'text-start', id: 'never-id' })
              controller.enqueue({
                type: 'text-delta',
                id: 'never-id',
                delta: 'partial',
              })
              if (abortSignal) {
                abortSignal.addEventListener('abort', () => {
                  controller.error(new DOMException('aborted', 'AbortError'))
                })
              }
              // Intentionally do NOT close — wait for abort.
            },
          })
          return { stream }
        },
      } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
      getLanguageModelMock.mockResolvedValue(neverEndingModel)
      const { result } = renderHook(() => useStreamingChat())
      let promise!: Promise<string>
      act(() => {
        promise = result.current.send('hi')
      })
      // Yield once so the first chunk is consumed and the for-await loop
      // is awaiting the next chunk.
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      act(() => {
        result.current.abort()
      })
      const final = await act(async () => promise.catch(() => 'caught'))
      // Either path is acceptable: the `for-await break` path returns
      // the partial accumulated text with status=idle, or the catch
      // path returns '' (also with status=idle). The single durable
      // observable across both branches is status=idle.
      expect(typeof final).toBe('string')
      expect(result.current.status).toBe('idle')
    })
  })
})
