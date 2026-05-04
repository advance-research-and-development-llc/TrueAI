/**
 * Golden eval: single-tool calculator goal.
 *
 * Goal: "what is (2 + 3) * 4"
 * Expected agent behaviour:
 *   1. Plan a single calculator call with input "(2 + 3) * 4".
 *   2. Receive "Result: 20" from the executor.
 *   3. Summarise with a final text response.
 */

import { describe, it, expect } from 'vitest'
import { runEval, expectedSequence } from '@/test/agent-eval-harness'

describe('agent eval: calculator-only', () => {
  it('dispatches a single calculator call and stops', async () => {
    const result = await runEval({
      goal: 'what is (2 + 3) * 4',
      toolOutputs: {
        calculator: 'Result: 20',
      },
      script: [
        {
          kind: 'tool-calls',
          calls: [{ tool: 'calculator', input: '(2 + 3) * 4' }],
        },
        {
          kind: 'final',
          text: 'The answer is 20.',
        },
      ],
    })

    expect(result.toolCalls).toEqual(
      expectedSequence({ tool: 'calculator', input: '(2 + 3) * 4' }),
    )
    expect(result.finalText).toMatch(/20/)
    expect(result.modelCalls).toBe(2)
  })
})
