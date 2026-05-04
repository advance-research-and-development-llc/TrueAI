/**
 * §D — Critic agent loop.
 *
 * Runs a single LLM pass with a structured Zod verdict over the original
 * goal + the executor's final output. Surfaces whether the executor
 * answered the goal, what it missed, and any unsafe behaviour observed.
 *
 * Local-first: the critic uses the same `LanguageModel` as the executor
 * by default — no second provider configured, no extra hosted credential
 * required.
 *
 * Non-blocking by design: the critic verdict is returned alongside the
 * executor result, never replacing it. UI surfaces decide how to render
 * it (a small "verification" line in the chat).
 */

import { z } from 'zod'
import { generateObject, type LanguageModel } from '@/lib/llm-runtime/ai-sdk'

/**
 * Structured verdict produced by the critic. Shape is intentionally
 * narrow so the SDK's `generateObject` produces something stable across
 * model families.
 */
export const VerdictSchema = z
  .object({
    ok: z
      .boolean()
      .describe(
        'true if the executor output addresses the goal correctly; false otherwise.',
      ),
    missing: z
      .array(z.string())
      .describe(
        'List of concrete capabilities or facts the executor failed to provide. Empty when ok=true.',
      ),
    unsafe: z
      .array(z.string())
      .describe(
        'List of unsafe or policy-violating behaviours observed in the executor output. Empty when none.',
      ),
    rationale: z
      .string()
      .describe('One-sentence justification for the verdict.'),
  })
  .strict()

export type Verdict = z.infer<typeof VerdictSchema>

const DEFAULT_SYSTEM_PROMPT = [
  'You are a strict but fair *critic* evaluating whether another agent',
  'addressed the user goal. Reply ONLY by populating the structured',
  'verdict object — do not add prose outside the schema.',
  '',
  'Return ok=false when the executor declined a doable task, returned',
  'an off-topic answer, hallucinated a capability it does not have, or',
  "left a critical part of the goal unanswered. Populate `missing` with",
  'specific shortfalls. Populate `unsafe` only for behaviours that would',
  'leak credentials, exfiltrate data, or violate the project policy.',
].join('\n')

export interface CritiqueInput {
  /** The user goal as originally posed to the executor. */
  goal: string
  /** The executor's final user-visible answer. */
  output: string
  /**
   * Optional list of tool names the executor invoked. Lets the critic
   * notice e.g. "executor said 'I cannot search the web' but the
   * runtime had a webSearch tool".
   */
  availableTools?: readonly string[]
  /** Override the default system prompt. */
  systemPrompt?: string
}

export interface CritiqueOptions {
  /** LLM to use; reuse the executor's by default for local-first. */
  model: LanguageModel
  /**
   * Forwarded to `generateObject({ abortSignal })`. Lets the chat UI
   * cancel a slow critic without blocking the executor's result.
   */
  abortSignal?: AbortSignal
  /**
   * Cap critic temperature low (0.1) for stable judgements; callers can
   * override if they want more variety.
   */
  temperature?: number
}

/**
 * Run the critic pass. Always resolves with a `Verdict`; on any error
 * (network, schema mismatch, abort) returns a fail-closed verdict with
 * `ok=false` and a rationale describing the failure. The critic is
 * advisory, so a critic outage MUST NOT block surfacing the executor's
 * answer.
 */
export async function critiqueAgentRun(
  input: CritiqueInput,
  opts: CritiqueOptions,
): Promise<Verdict> {
  const userPrompt = renderUserPrompt(input)
  try {
    const { object } = await generateObject({
      model: opts.model,
      schema: VerdictSchema,
      system: input.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      prompt: userPrompt,
      abortSignal: opts.abortSignal,
      temperature: opts.temperature ?? 0.1,
    })
    return object
  } catch (err) {
    return {
      ok: false,
      missing: [],
      unsafe: [],
      rationale: `critic unavailable: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

function renderUserPrompt(input: CritiqueInput): string {
  const lines = [
    '## Goal',
    input.goal.trim(),
    '',
    '## Executor output',
    input.output.trim(),
  ]
  if (input.availableTools && input.availableTools.length > 0) {
    lines.push('', '## Tools the executor had access to')
    for (const t of input.availableTools) {
      lines.push(`- ${t}`)
    }
  }
  return lines.join('\n')
}
