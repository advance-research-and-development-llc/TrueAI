/**
 * §D — Critic agent loop tests.
 *
 * Validates that:
 *   1. The critic runs `generateObject` with the verdict schema and
 *      surfaces the model's structured output verbatim.
 *   2. A failing model resolves with a fail-closed verdict (no throw).
 *   3. The critic flags a known regression: executor that returned
 *      "I cannot search the web" when the goal required search and a
 *      webSearch tool was available → ok=false, missing populated.
 */

import { describe, it, expect, vi } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'
import type { LanguageModel } from '@/lib/llm-runtime/ai-sdk'
import { critiqueAgentRun, VerdictSchema, type Verdict } from './critic'

/**
 * Build a model that, when asked for a JSON object, returns the
 * provided verdict serialised. The Vercel AI SDK's `generateObject`
 * sends a constrained-JSON request that resolves to the verdict shape
 * after running through the schema validator.
 */
function modelReturningVerdict(verdict: Verdict): LanguageModel {
  return new MockLanguageModelV3({
    provider: 'mock-critic',
    modelId: 'mock-critic-model',
    doGenerate: async () => {
      return {
        content: [{ type: 'text', text: JSON.stringify(verdict) }],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        warnings: [],
      }
    },
  } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
}

function modelThatThrows(message: string): LanguageModel {
  return new MockLanguageModelV3({
    provider: 'mock-critic',
    modelId: 'mock-critic-error',
    doGenerate: async () => {
      throw new Error(message)
    },
  } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
}

describe('critic', () => {
  it('surfaces a positive verdict from a well-formed model response', async () => {
    const expected: Verdict = {
      ok: true,
      missing: [],
      unsafe: [],
      rationale: 'executor produced the requested sum.',
    }
    const verdict = await critiqueAgentRun(
      { goal: 'add 2 and 3', output: 'The answer is 5.' },
      { model: modelReturningVerdict(expected) },
    )
    expect(verdict).toEqual(expected)
    expect(VerdictSchema.parse(verdict)).toEqual(expected)
  })

  it('flags a known regression: refused doable web-search task', async () => {
    const expected: Verdict = {
      ok: false,
      missing: ['web search backend'],
      unsafe: [],
      rationale:
        "executor declined despite a webSearch tool being available.",
    }
    const verdict = await critiqueAgentRun(
      {
        goal: 'find me the latest changelog for vite',
        output: 'I cannot search the web.',
        availableTools: ['webSearch', 'currentTime'],
      },
      { model: modelReturningVerdict(expected) },
    )
    expect(verdict.ok).toBe(false)
    expect(verdict.missing).toContain('web search backend')
  })

  it('returns a fail-closed verdict when the model errors out', async () => {
    const verdict = await critiqueAgentRun(
      { goal: 'anything', output: 'whatever' },
      { model: modelThatThrows('network down') },
    )
    expect(verdict.ok).toBe(false)
    expect(verdict.rationale).toContain('critic unavailable')
    expect(verdict.rationale).toContain('network down')
    expect(verdict.missing).toEqual([])
    expect(verdict.unsafe).toEqual([])
  })

  it('forwards an abort signal to the underlying generateObject call', async () => {
    const onCall = vi.fn()
    const model = new MockLanguageModelV3({
      provider: 'mock-critic',
      modelId: 'mock-critic-abort',
      doGenerate: async (callOpts: unknown) => {
        onCall(callOpts)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ok: true,
                missing: [],
                unsafe: [],
                rationale: 'fine.',
              }),
            },
          ],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        }
      },
    } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
    const ctrl = new AbortController()
    await critiqueAgentRun(
      { goal: 'g', output: 'o' },
      { model, abortSignal: ctrl.signal },
    )
    expect(onCall).toHaveBeenCalledTimes(1)
    const callOpts = onCall.mock.calls[0][0] as { abortSignal?: AbortSignal }
    expect(callOpts.abortSignal).toBe(ctrl.signal)
  })
})
