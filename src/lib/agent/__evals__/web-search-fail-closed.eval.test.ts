/**
 * Golden eval: local-first fail-closed contract.
 *
 * Goal: "search the web for X"
 * Expected agent behaviour in this local-first runtime:
 *   1. Try `web_search` once.
 *   2. Receive an explicit failure ("not available in local-first runtime").
 *   3. Surface the limitation in the final answer rather than
 *      pretending the call succeeded.
 *
 * This pins the most important *correctness* property: when a
 * tool fails closed, the agent must NOT silently retry until the
 * loop budget is exhausted, and must NOT confabulate output.
 */

import { describe, it, expect } from 'vitest'
import { runEval, expectedSequence } from '@/test/agent-eval-harness'

describe('agent eval: local-first fail-closed', () => {
  it('does not retry web_search and surfaces the limitation in the final text', async () => {
    const result = await runEval({
      goal: 'search the web for the latest TrueAI release',
      toolOutputs: {
        web_search: {
          success: false,
          output: 'web_search not available in local-first runtime',
        },
      },
      script: [
        {
          kind: 'tool-calls',
          calls: [{ tool: 'web_search', input: 'latest TrueAI release' }],
        },
        {
          kind: 'final',
          text:
            'I cannot search the web in this local-first runtime; ' +
            "the web_search tool failed because no search backend is wired.",
        },
      ],
    })

    expect(result.toolCalls).toEqual(
      expectedSequence({ tool: 'web_search', input: 'latest TrueAI release' }),
    )
    // Critical: only ONE web_search attempt — the agent must not
    // hammer a fail-closed tool repeatedly.
    expect(
      result.toolCalls.filter((c) => c.tool === 'web_search').length,
    ).toBe(1)
    expect(result.finalText).toMatch(/local-first|not available|cannot/i)
  })
})
