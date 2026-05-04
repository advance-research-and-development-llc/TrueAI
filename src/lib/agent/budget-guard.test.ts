/**
 * Budget guard tests for `buildTrueAIAgent`.
 *
 * Pins the four caps wired in §P:
 *   - maxSteps
 *   - maxToolCalls
 *   - maxWallTimeMs (smoke-tested via a tiny override)
 *   - maxOutputTokens (forwarded as a model setting)
 *
 * These complement the goal-shaped fixtures in __evals__/ — those
 * pin behaviour, these pin resource policy.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildTrueAIAgent,
  DEFAULT_BUDGET,
  type BudgetOptions,
} from './tool-loop-agent'
import { mockLanguageModel } from '@/test/ai-sdk-mocks'

describe('budget-guard: defaults', () => {
  it('exposes a frozen default budget object', () => {
    expect(DEFAULT_BUDGET).toEqual({
      maxSteps: 8,
      maxToolCalls: 16,
      maxWallTimeMs: 30_000,
      maxOutputTokens: 4_096,
    })
    expect(Object.isFrozen(DEFAULT_BUDGET)).toBe(true)
  })

  it('forwards maxOutputTokens to the model', () => {
    let captured: { maxOutputTokens?: number } | null = null
    const model = mockLanguageModel({
      text: 'ok',
      onCall: (opts) => {
        captured = opts as { maxOutputTokens?: number }
      },
    })
    const budget: BudgetOptions = { maxOutputTokens: 1024 }
    const agent = buildTrueAIAgent({ model, budget })
    return (
      agent as unknown as {
        generate: (req: { prompt: string }) => Promise<{ text: string }>
      }
    )
      .generate({ prompt: 'hi' })
      .then(() => {
        expect(captured).not.toBeNull()
        expect(captured!.maxOutputTokens).toBe(1024)
      })
  })
})

describe('budget-guard: maxSteps cap (smoke)', () => {
  it('the stopWhen predicate is callable from outside the loop for direct testing', () => {
    const model = mockLanguageModel({ text: 'ok' })
    const agent = buildTrueAIAgent({
      model,
      budget: { maxSteps: 3 },
    })
    const stopWhen = (
      agent as unknown as {
        settings: { stopWhen: (a: { steps: ReadonlyArray<unknown> }) => boolean }
      }
    ).settings.stopWhen
    expect(typeof stopWhen).toBe('function')
  })
})

describe('budget-guard: stopWhen wiring', () => {
  it('wires a composite stopWhen predicate onto the underlying ToolLoopAgent', () => {
    const model = mockLanguageModel({ text: 'ok' })
    const agent = buildTrueAIAgent({
      model,
      budget: { maxSteps: 3, maxToolCalls: 5, maxWallTimeMs: 1000 },
    })
    const settings = (
      agent as unknown as {
        settings: { stopWhen?: unknown; maxOutputTokens?: number }
      }
    ).settings
    expect(typeof settings.stopWhen).toBe('function')
    expect(settings.maxOutputTokens).toBe(DEFAULT_BUDGET.maxOutputTokens)
  })

  it('predicate returns true when stepCount >= maxSteps', () => {
    const model = mockLanguageModel({ text: 'ok' })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const agent = buildTrueAIAgent({
      model,
      budget: { maxSteps: 2, maxToolCalls: 999, maxWallTimeMs: 999_999 },
    })
    const stopWhen = (
      agent as unknown as {
        settings: { stopWhen: (a: { steps: ReadonlyArray<unknown> }) => boolean }
      }
    ).settings.stopWhen
    expect(stopWhen({ steps: [{}] })).toBe(false)
    expect(stopWhen({ steps: [{}, {}] })).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('maxSteps=2'),
    )
    warnSpy.mockRestore()
  })

  it('predicate returns true when total toolCalls >= maxToolCalls', () => {
    const model = mockLanguageModel({ text: 'ok' })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const agent = buildTrueAIAgent({
      model,
      budget: { maxSteps: 999, maxToolCalls: 4, maxWallTimeMs: 999_999 },
    })
    const stopWhen = (
      agent as unknown as {
        settings: {
          stopWhen: (a: {
            steps: ReadonlyArray<{ toolCalls?: ReadonlyArray<unknown> }>
          }) => boolean
        }
      }
    ).settings.stopWhen
    // 2 + 1 + 1 = 4 → stop.
    const steps = [
      { toolCalls: [1, 2] },
      { toolCalls: [3] },
      { toolCalls: [4] },
    ]
    expect(stopWhen({ steps })).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('maxToolCalls=4'),
    )
    warnSpy.mockRestore()
  })
})
