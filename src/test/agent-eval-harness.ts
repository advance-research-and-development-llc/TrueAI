/**
 * Agent eval harness — golden tests for `ToolLoopAgent` behaviour.
 *
 * The harness builds a *scripted* mock language model that walks
 * through a fixture-defined sequence of responses, then asserts the
 * agent invoked the executor with the expected (toolName, input)
 * tuples in order.
 *
 * Why this exists
 *   The agent loop is one of the highest-blast-radius parts of the
 *   codebase: a regression here silently turns Copilot / on-device
 *   sessions into noise without producing any visible failure. The
 *   prior coverage was a single 97-line happy-path test in
 *   `tool-loop-agent.test.ts`. This harness lets us pin a growing
 *   library of deterministic goal → tool-sequence fixtures so
 *   refactors of the loop (planned: §B tool-registry, §D critic,
 *   §P budget guard) can proceed with confidence.
 *
 * Determinism
 *   No real model is invoked. The scripted model emits exactly the
 *   tool-call / text content the fixture supplies, in order. The
 *   executor is a stub that returns canned outputs, so we never run
 *   real `web_search`, `image_generator`, etc. — meaning these
 *   evals are safe to run in any CI / device sandbox.
 */

import { MockLanguageModelV3 } from 'ai/test'
import type { LanguageModel } from '@/lib/llm-runtime/ai-sdk'
import { AgentToolExecutor } from '@/lib/agent-tools'
import { buildTrueAIAgent } from '@/lib/agent/tool-loop-agent'
import type { AgentTool } from '@/lib/types'

/**
 * One scripted "turn" the model produces. Either a list of tool
 * calls (causing the agent to dispatch them in parallel through
 * the executor) or a final text response (terminating the loop).
 */
export type ScriptedTurn =
  | { kind: 'tool-calls'; calls: { tool: AgentTool; input: string }[] }
  | { kind: 'final'; text: string }

/**
 * Map of `AgentTool` → canned output string. Defaults to a generic
 * stub if a tool isn't listed. The executor records every call for
 * later assertion.
 */
export type StubToolOutputs = Partial<Record<AgentTool, string | { success: boolean; output: string }>>

export interface RunEvalOptions {
  /** The user goal that gets passed to `agent.generate({ prompt })`. */
  goal: string
  /** Scripted model turns, in order. The last one MUST be `kind: 'final'`. */
  script: ScriptedTurn[]
  /** Canned tool outputs. Missing tools return a generic stub. */
  toolOutputs?: StubToolOutputs
  /** Optional system-prompt override. */
  system?: string
}

export interface EvalResult {
  /** Every `executor.executeTool(...)` call, in order. */
  toolCalls: { tool: AgentTool; input: string }[]
  /** The final assistant text the agent produced. */
  finalText: string
  /** Number of `doGenerate` invocations the model received. */
  modelCalls: number
}

let __callIdSeq = 0
function nextCallId(): string {
  __callIdSeq += 1
  return `call_${__callIdSeq}`
}

/**
 * Build a `LanguageModel` that walks `script` linearly. Tool-call
 * turns emit `tool-call` content parts with `finishReason:
 * 'tool-calls'`; the final turn emits a single text part with
 * `finishReason: 'stop'`. Calls past the script length throw —
 * a fixture that doesn't terminate is a bug in the fixture.
 */
function scriptedModel(script: ScriptedTurn[], onCall: () => void): LanguageModel {
  let cursor = 0
  return new MockLanguageModelV3({
    provider: 'eval-harness',
    modelId: 'scripted',
    doGenerate: async () => {
      onCall()
      if (cursor >= script.length) {
        throw new Error(
          `agent-eval-harness: model exhausted at step ${cursor}; ` +
            `script has ${script.length} turns. Fixture likely missing a final turn.`,
        )
      }
      const turn = script[cursor++]

      if (turn.kind === 'final') {
        return {
          content: [{ type: 'text', text: turn.text }],
          finishReason: 'stop',
          usage: { inputTokens: 4, outputTokens: 4, totalTokens: 8 },
          warnings: [],
        }
      }

      return {
        content: turn.calls.map((c) => ({
          type: 'tool-call' as const,
          toolCallId: nextCallId(),
          toolName: c.tool,
          // The AI SDK parses tool-call input from a JSON-encoded
          // *string* via safeParseJSON. Passing a raw object skips
          // execution silently (the parse becomes a no-op and tools
          // never run). JSON-stringify the args object so the SDK
          // can validate it against the tool's Zod inputSchema.
          input: JSON.stringify({ input: c.input }),
        })),
        finishReason: 'tool-calls',
        usage: { inputTokens: 4, outputTokens: 2 * turn.calls.length, totalTokens: 4 + 2 * turn.calls.length },
        warnings: [],
      }
    },
  } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]) as unknown as LanguageModel
}

/**
 * Run a fixture and return the recorded tool-call sequence + final
 * text. Stateless: each call gets its own executor + agent.
 */
export async function runEval(opts: RunEvalOptions): Promise<EvalResult> {
  const recorded: { tool: AgentTool; input: string }[] = []
  const outputs = opts.toolOutputs ?? {}

  const executor = new AgentToolExecutor()
  // Replace executeTool with a deterministic stub that records every
  // call and returns the fixture's canned output. We do not call
  // through to the real tools — a `calculator` eval should not hit
  // the real eval(), a `web_search` eval should not hit the network,
  // etc.
  ;(executor as unknown as {
    executeTool: (tool: AgentTool, input: string) => Promise<{ success: boolean; output: string }>
  }).executeTool = async (tool, input) => {
    recorded.push({ tool, input })
    const o = outputs[tool]
    if (o === undefined) {
      return { success: true, output: `stub:${tool}(${input})` }
    }
    if (typeof o === 'string') {
      return { success: true, output: o }
    }
    return o
  }

  let modelCalls = 0
  const model = scriptedModel(opts.script, () => {
    modelCalls += 1
  })

  const agent = buildTrueAIAgent({ model, executor, system: opts.system })

  // ToolLoopAgent's generate signature is variant-shaped depending
  // on AI SDK version; we cast through unknown for the eval harness.
  const result = (await (
    agent as unknown as {
      generate: (req: { prompt: string }) => Promise<{ text: string }>
    }
  ).generate({ prompt: opts.goal })) as { text: string }

  return {
    toolCalls: recorded,
    finalText: result.text ?? '',
    modelCalls,
  }
}

/**
 * Convenience matcher: assert recorded tool calls equal the
 * expected sequence (deep-equal). Call from a test with
 *   expect(result.toolCalls).toEqual(expectedSequence)
 * — but importing this keeps the assertion phrasing consistent.
 */
export function expectedSequence(
  ...calls: { tool: AgentTool; input: string }[]
): { tool: AgentTool; input: string }[] {
  return calls
}
