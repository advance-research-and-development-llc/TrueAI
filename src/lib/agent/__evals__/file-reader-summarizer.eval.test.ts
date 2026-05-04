/**
 * Golden eval: multi-tool plan, dispatched in correct order.
 *
 * Goal: "summarise the file ./README.md"
 * Expected agent behaviour:
 *   1. Call file_reader to load the file.
 *   2. Call summarizer with the loaded text.
 *   3. Final answer paraphrases the summary.
 *
 * This pins the *ordering* contract: we want the agent to never
 * call summarizer before file_reader, because the summarizer's
 * input depends on the file_reader's output.
 */

import { describe, it, expect } from 'vitest'
import { runEval, expectedSequence } from '@/test/agent-eval-harness'

describe('agent eval: file_reader → summarizer chain', () => {
  it('reads the file before summarising and emits both calls in order', async () => {
    const fileContents = '# Hello\n\nA repo for local-first agents.'
    const summary = 'A repo for local-first agents.'

    const result = await runEval({
      goal: 'summarise the file ./README.md',
      toolOutputs: {
        file_reader: fileContents,
        summarizer: summary,
      },
      script: [
        {
          kind: 'tool-calls',
          calls: [{ tool: 'file_reader', input: './README.md' }],
        },
        {
          kind: 'tool-calls',
          calls: [{ tool: 'summarizer', input: fileContents }],
        },
        {
          kind: 'final',
          text: `Summary: ${summary}`,
        },
      ],
    })

    expect(result.toolCalls).toEqual(
      expectedSequence(
        { tool: 'file_reader', input: './README.md' },
        { tool: 'summarizer', input: fileContents },
      ),
    )
    expect(result.toolCalls[0].tool).toBe('file_reader')
    expect(result.toolCalls[1].tool).toBe('summarizer')
    expect(result.finalText).toContain(summary)
    expect(result.modelCalls).toBe(3)
  })
})
