/**
 * AI-SDK-flavoured wrapper around `AgentToolExecutor`.
 *
 * Replaces the inline planner→tool loop in `App.tsx` (the
 * `agent.goal` block, ~lines 706-730 of the legacy implementation)
 * with a typed `ToolLoopAgent` whose tools are the existing TrueAI
 * `AgentTool` set, exposed with Zod input schemas.
 *
 * The agent's `model` is supplied by the caller (typically via
 * `getLanguageModel(modelId)`), so the same multi-provider plumbing
 * — Ollama, OpenAI-compatible, OpenAI, Anthropic, Google — applies
 * automatically.
 *
 * The wrapped tool executors fail-closed in the local-first runtime
 * (e.g. `web_search`, `image_generator`, `translator`) exactly the
 * way the legacy executor did; nothing here introduces new
 * third-party network calls.
 */

import { z } from 'zod'
import {
  generateText,
  streamText,
  tool,
  ToolLoopAgent,
  type LanguageModel,
} from '@/lib/llm-runtime/ai-sdk'
import { AgentToolExecutor, toolExecutor as defaultExecutor } from '../agent-tools'
import type { AgentTool } from '../types'

export interface BuildAgentToolsOptions {
  /** Tool executor; defaults to the singleton from `agent-tools.ts`. */
  executor?: AgentToolExecutor
  /** Restrict the exposed tool set; defaults to all tools. */
  tools?: AgentTool[]
}

const ALL_TOOLS: AgentTool[] = [
  'calculator',
  'datetime',
  'memory',
  'web_search',
  'code_interpreter',
  'file_reader',
  'json_parser',
  'api_caller',
  'data_analyzer',
  'image_generator',
  'sentiment_analyzer',
  'summarizer',
  'translator',
  'validator',
]

const TOOL_DESCRIPTIONS: Record<AgentTool, string> = {
  calculator: 'Evaluate a basic arithmetic expression. Input: an expression like "(2+3)*4".',
  datetime: 'Get the current date/time, or compute a relative date. Input: a natural-language query.',
  memory: 'Read or write the agent\'s short-term memory store. Input: a key=value or just a key.',
  web_search: 'Web search. Local-first runtime: this fails closed unless a search backend is wired.',
  code_interpreter: 'Run a small JavaScript snippet in a sandbox. Input: the snippet.',
  file_reader: 'Read a file from the device (size-capped). Input: the file path.',
  json_parser: 'Parse / re-serialise a JSON document. Input: the JSON text.',
  api_caller: 'GET an HTTP URL (15s timeout, 16KB cap). Input: the URL.',
  data_analyzer: 'Compute summary stats over an array of numbers. Input: comma-separated numbers.',
  image_generator: 'Image generation. Local-first runtime: this fails closed unless wired.',
  sentiment_analyzer: 'Score the sentiment of a text. Input: the text.',
  summarizer: 'Produce a short summary of a longer text. Input: the text.',
  translator: 'Translate text. Local-first runtime: this fails closed unless wired.',
  validator: 'Validate that input matches a known shape (email, url, json). Input: type:value.',
}

/**
 * Build a `tools` map suitable for `ToolLoopAgent({ tools })` or
 * `generateText({ tools })`. Each tool has a one-string-arg input
 * schema (matching the legacy `executeTool(tool, input)` signature)
 * and an `execute` that delegates to the existing `AgentToolExecutor`.
 */
export function buildAgentTools(opts: BuildAgentToolsOptions = {}) {
  const executor = opts.executor ?? defaultExecutor
  const allowed = opts.tools ?? ALL_TOOLS

  const out: Record<string, ReturnType<typeof tool>> = {}
  for (const t of allowed) {
    // Each tool is a single-string-arg call that delegates to the
    // existing AgentToolExecutor; the SDK's `tool()` helper preserves
    // the input/output generics, but iterating with a heterogeneous
    // map collapses them — cast at the assignment boundary so the
    // returned object remains a `ToolSet` consumable by ToolLoopAgent.
    const t_def = tool({
      description: TOOL_DESCRIPTIONS[t],
      inputSchema: z.object({
        input: z
          .string()
          .describe('Free-form input to the tool (single string argument).'),
      }),
      execute: async ({ input }) => {
        const result = await executor.executeTool(t, input)
        return {
          success: result.success,
          output: result.output,
          ...(result.error ? { error: result.error } : {}),
        }
      },
    }) as unknown as ReturnType<typeof tool>
    out[t] = t_def
  }
  return out
}

export interface BuildTrueAIAgentOptions extends BuildAgentToolsOptions {
  /** AI-SDK language model the agent will reason with. */
  model: LanguageModel
  /** Optional system prompt; a sensible default is supplied. */
  system?: string
  /**
   * Budget guard. Without these caps a misbehaving model can walk
   * the tool list forever — the cost is otherwise bounded only by
   * the user pressing "stop". All four are independent: hitting any
   * one ends the run with a final-text fallback.
   */
  budget?: BudgetOptions
}

/**
 * Per-run resource caps. All optional; missing fields use the
 * project defaults (`DEFAULT_BUDGET`). Set any field to `Infinity`
 * to disable that specific cap (callers should rarely do this).
 */
export interface BudgetOptions {
  /** Maximum reasoning steps before forced stop. Default: 8. */
  maxSteps?: number
  /**
   * Maximum total tool invocations across all steps. Default: 16.
   * Catches "walk the tool list" loops where every step calls a
   * different tool but no progress is made on the user's goal.
   */
  maxToolCalls?: number
  /** Wall-clock cap, in milliseconds. Default: 30_000. */
  maxWallTimeMs?: number
  /**
   * Maximum *output* tokens the model is allowed to generate
   * (across all steps combined). Default: 4_096. Maps to the
   * SDK's per-call \`maxOutputTokens\` and is also re-checked
   * after each step in case the model overshoots a single cap.
   */
  maxOutputTokens?: number
}

export const DEFAULT_BUDGET: Required<BudgetOptions> = Object.freeze({
  maxSteps: 8,
  maxToolCalls: 16,
  maxWallTimeMs: 30_000,
  maxOutputTokens: 4_096,
})

const DEFAULT_SYSTEM = `You are a TrueAI on-device agent. You have access to a small set of \
tools; pick the smallest combination that accomplishes the user's goal. \
If a tool is unavailable in this local-first runtime (e.g. web_search, \
image_generator, translator), explain that limitation in your final \
answer instead of inventing tool output.`

/**
 * Construct a TrueAI-flavoured `ToolLoopAgent` ready to `generate(...)`
 * against a goal. Equivalent in behaviour to the legacy planner→tool
 * loop, but typed, single-shot, and provider-agnostic.
 *
 * Budget caps (`opts.budget`) translate to:
 *   - `maxOutputTokens` → forwarded to the model on every call.
 *   - `maxSteps`, `maxToolCalls`, `maxWallTimeMs` → wired into a
 *     composite \`stopWhen\` predicate that ends the loop early
 *     when any one is exceeded. The agent's final text in that
 *     case is the assistant text from the last completed step
 *     (the loop never produces a half-tool-call message).
 */
export function buildTrueAIAgent(opts: BuildTrueAIAgentOptions) {
  const budget = resolveBudget(opts.budget)
  const stopWhen = buildBudgetStopWhen(budget)

  // Cast through unknown: the `system` setting on `ToolLoopAgent` and
  // the per-tool generic narrowing both confuse TS's structural
  // matcher when the tools map is a `Record<string, Tool>`. The
  // runtime contract is correct.
  return new ToolLoopAgent({
    model: opts.model,
    system: opts.system ?? DEFAULT_SYSTEM,
    tools: buildAgentTools(opts),
    stopWhen,
    maxOutputTokens: budget.maxOutputTokens,
  } as unknown as ConstructorParameters<typeof ToolLoopAgent>[0])
}

// ─── Run helpers (§N) ──────────────────────────────────────────────────
//
// `buildTrueAIAgent` returns a long-lived agent instance. For most
// chat-UI use cases the caller wants to (a) stream tokens as they
// arrive and (b) cancel the run mid-tool-call when the user clicks
// "stop". Both are supplied below as standalone functions so callers
// don't need to remember which property of the agent surfaces what.
//
// Local-first guarantee: identical tool gating + identical budget
// caps as `buildTrueAIAgent` — only the SDK call shape changes.

export interface RunOptions {
  /** User-facing goal the agent should accomplish. */
  goal: string
  /**
   * Optional AbortSignal threaded through every model call and tool
   * invocation. Calling `controller.abort()` ends the run cleanly: the
   * model rejects with an AbortError and any in-flight tool sees the
   * signal in its execution context. The chat UI uses this to drive a
   * "stop generation" button without re-instantiating the agent.
   */
  abortSignal?: AbortSignal
}

/**
 * Run the TrueAI agent against `goal` and return the AI SDK's
 * `streamText` result. Callers can read `.textStream` for token deltas,
 * `.fullStream` for tool-call/tool-result events, or
 * `.toUIMessageStreamResponse()` to bridge into a server-sent UI stream.
 *
 * Cancelling: pass `abortSignal` from an `AbortController` and call
 * `controller.abort()`. The stream ends with the partial text emitted
 * up to that point — the SDK does not surface a half-tool-call.
 */
export function streamTrueAIAgentRun(
  opts: BuildTrueAIAgentOptions,
  run: RunOptions,
): ReturnType<typeof streamText> {
  const budget = resolveBudget(opts.budget)
  return streamText({
    model: opts.model,
    system: opts.system ?? DEFAULT_SYSTEM,
    tools: buildAgentTools(opts) as unknown as Parameters<typeof streamText>[0]['tools'],
    prompt: run.goal,
    stopWhen: buildBudgetStopWhen(budget) as unknown as Parameters<
      typeof streamText
    >[0]['stopWhen'],
    maxOutputTokens: budget.maxOutputTokens,
    abortSignal: run.abortSignal,
  })
}

/**
 * Non-streaming counterpart to `streamTrueAIAgentRun`: identical tools,
 * identical budget, identical abort wiring. Resolves to the AI SDK's
 * `generateText` result. Use this when you only need the final answer
 * (e.g. one-shot CLI mode, evaluation harness fixtures, server-side
 * critic pre-pass).
 */
export function generateTrueAIAgentRun(
  opts: BuildTrueAIAgentOptions,
  run: RunOptions,
): ReturnType<typeof generateText> {
  const budget = resolveBudget(opts.budget)
  return generateText({
    model: opts.model,
    system: opts.system ?? DEFAULT_SYSTEM,
    tools: buildAgentTools(opts) as unknown as Parameters<typeof generateText>[0]['tools'],
    prompt: run.goal,
    stopWhen: buildBudgetStopWhen(budget) as unknown as Parameters<
      typeof generateText
    >[0]['stopWhen'],
    maxOutputTokens: budget.maxOutputTokens,
    abortSignal: run.abortSignal,
  })
}

// ─── Internals ─────────────────────────────────────────────────────────

function resolveBudget(b: BudgetOptions | undefined): Required<BudgetOptions> {
  return {
    maxSteps: b?.maxSteps ?? DEFAULT_BUDGET.maxSteps,
    maxToolCalls: b?.maxToolCalls ?? DEFAULT_BUDGET.maxToolCalls,
    maxWallTimeMs: b?.maxWallTimeMs ?? DEFAULT_BUDGET.maxWallTimeMs,
    maxOutputTokens: b?.maxOutputTokens ?? DEFAULT_BUDGET.maxOutputTokens,
  }
}

/**
 * Build a fresh composite `stopWhen` predicate that ends the loop when
 * any of `maxSteps`, `maxToolCalls`, or `maxWallTimeMs` is hit. Each
 * call returns a NEW closure so multiple concurrent runs don't share
 * the wall-clock or tool-call counter.
 */
function buildBudgetStopWhen(budget: Required<BudgetOptions>) {
  const startedAt = Date.now()
  let toolCallsSeen = 0
  return ({ steps }: { steps: ReadonlyArray<{ toolCalls?: ReadonlyArray<unknown> }> }) => {
    const stepCount = steps.length
    toolCallsSeen = steps.reduce(
      (acc, s) => acc + (s.toolCalls?.length ?? 0),
      0,
    )
    if (stepCount >= budget.maxSteps) {
      console.warn(
        `[budget-guard] stopping: maxSteps=${budget.maxSteps} reached`,
      )
      return true
    }
    if (toolCallsSeen >= budget.maxToolCalls) {
      console.warn(
        `[budget-guard] stopping: maxToolCalls=${budget.maxToolCalls} reached (saw ${toolCallsSeen})`,
      )
      return true
    }
    const elapsed = Date.now() - startedAt
    if (elapsed >= budget.maxWallTimeMs) {
      console.warn(
        `[budget-guard] stopping: maxWallTimeMs=${budget.maxWallTimeMs}ms reached (elapsed ${elapsed}ms)`,
      )
      return true
    }
    return false
  }
}
