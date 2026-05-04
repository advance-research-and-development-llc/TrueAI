/**
 * Local-first agent tool registry.
 *
 * This is the typed, multi-arg successor to the single-string-arg shim
 * in `./tool-loop-agent.ts`'s `buildAgentTools()`. Both surfaces coexist;
 * legacy callers keep working while new code can register tools with
 * arbitrary Zod input schemas and explicit network / credential gating.
 *
 * Design goals
 *   1. **Local-first by default.** A tool only sees the network if it
 *      sets `requiresNetwork: true` AND the runtime confirms a hosted
 *      LLM credential is configured. Otherwise the registry refuses to
 *      hand it out. This is consistent with the rest of the app's
 *      "hosted providers stay opt-in" rule.
 *   2. **No credential leaks.** Tools that look up KV keys reject the
 *      sensitive prefixes the rest of the codebase pins (mirrors the
 *      regression test in `src/lib/llm-runtime/kv-store.test.ts`).
 *   3. **Idempotent registration.** Re-registering the same name throws
 *      so a typo can't shadow an established tool.
 *   4. **Backwards compatible.** Adding this file does not change any
 *      existing tool execution path. The legacy `AgentToolExecutor`
 *      continues to drive `App.tsx`.
 */

import { z } from 'zod'
import { tool } from '@/lib/llm-runtime/ai-sdk'
import { secureStorage } from '@/lib/native/secure-storage'

/**
 * Storage key under which the LLM API key is held by `secureStorage`.
 * Mirrors the constant used throughout `src/lib/llm-runtime/`.
 */
export const LLM_API_KEY_STORAGE_KEY = '__llm_runtime_api_key__'

/**
 * KV key prefixes that must NEVER be exposed to a tool, even one that
 * legitimately reads from `kvStore`. Mirrors the leak-regression
 * coverage in `src/lib/llm-runtime/kv-store.test.ts`.
 */
const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /^__llm_runtime_api_key__/,
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
]

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key))
}

export interface ToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = unknown,
> {
  /** Stable machine-readable identifier; used as the tool name. */
  name: string
  /** Short description surfaced to the LLM. */
  description: string
  /** Zod schema for the tool's input arguments. */
  inputSchema: TInput
  /**
   * If true, the tool may make outbound network calls. Such tools are
   * only handed out when a hosted-LLM credential is configured (or an
   * explicit override is supplied at build time).
   */
  requiresNetwork?: boolean
  /**
   * If true, the tool requires a configured credential (currently
   * checked against `secureStorage[LLM_API_KEY_STORAGE_KEY]`). Implies
   * `requiresNetwork`.
   */
  requiresCredential?: boolean
  /** Tool implementation. */
  execute: (
    input: z.infer<TInput>,
    ctx: ToolExecutionContext,
  ) => Promise<TOutput> | TOutput
}

export interface ToolExecutionContext {
  /** AbortSignal threaded through the agent loop, if any. */
  signal?: AbortSignal
}

export interface RegistryBuildOptions {
  /**
   * If true, network/credential-gated tools are forced into the output
   * regardless of credential state. Intended for tests only.
   */
  forceUnlockGatedTools?: boolean
}

/**
 * Read-only view of the registry, suitable for passing around app code
 * without exposing the mutating `register`.
 */
export interface ToolRegistryView {
  list(): ToolDefinition[]
  get(name: string): ToolDefinition | undefined
  has(name: string): boolean
}

export class ToolRegistry implements ToolRegistryView {
  private readonly tools = new Map<string, ToolDefinition>()

  /** Register a tool. Throws on duplicate name. */
  register<TInput extends z.ZodTypeAny, TOutput>(
    def: ToolDefinition<TInput, TOutput>,
  ): void {
    if (this.tools.has(def.name)) {
      throw new Error(
        `ToolRegistry: a tool named "${def.name}" is already registered`,
      )
    }
    // Coerce the per-tool generic into the registry's invariant view; the
    // execute() boundary preserves the original schema's type at the call
    // site via `inferToolInput`.
    this.tools.set(def.name, def as unknown as ToolDefinition)
  }

  /** Replace any existing definition; primarily for tests. */
  upsert<TInput extends z.ZodTypeAny, TOutput>(
    def: ToolDefinition<TInput, TOutput>,
  ): void {
    this.tools.set(def.name, def as unknown as ToolDefinition)
  }

  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  clear(): void {
    this.tools.clear()
  }

  /**
   * Build a Vercel-AI-SDK tool map ready for `ToolLoopAgent({ tools })`
   * or `generateText({ tools })`. Network/credential-gated tools are
   * filtered out unless the runtime confirms a credential — preserving
   * the local-first guarantee.
   */
  async buildToolSet(
    opts: RegistryBuildOptions = {},
  ): Promise<Record<string, ReturnType<typeof tool>>> {
    const credentialPresent = opts.forceUnlockGatedTools
      ? true
      : await hasConfiguredCredential()

    const out: Record<string, ReturnType<typeof tool>> = {}
    for (const def of this.tools.values()) {
      const gated = def.requiresNetwork || def.requiresCredential
      if (gated && !credentialPresent) {
        continue
      }
      out[def.name] = wrapAsAiSdkTool(def)
    }
    return out
  }
}

/**
 * Returns true if a hosted-LLM credential is currently configured. The
 * registry uses this to decide whether to expose `requiresNetwork` /
 * `requiresCredential` tools. Errors from `secureStorage` are
 * conservatively treated as "no credential" so tools fail closed.
 */
export async function hasConfiguredCredential(): Promise<boolean> {
  try {
    const v = await secureStorage.get(LLM_API_KEY_STORAGE_KEY)
    return typeof v === 'string' && v.length > 0
  } catch {
    return false
  }
}

function wrapAsAiSdkTool(def: ToolDefinition): ReturnType<typeof tool> {
  return tool({
    description: def.description,
    inputSchema: def.inputSchema,
    execute: async (input: unknown, ctx?: { abortSignal?: AbortSignal }) => {
      const result = await def.execute(input as z.infer<typeof def.inputSchema>, {
        signal: ctx?.abortSignal,
      })
      return result
    },
  }) as unknown as ReturnType<typeof tool>
}

// ─── Built-in seed tools ────────────────────────────────────────────────
// All three are zero-network and exercise the registry end-to-end.

const currentTimeTool: ToolDefinition = {
  name: 'currentTime',
  description:
    'Return the current date and time in ISO-8601 form, plus the resolved IANA time zone.',
  inputSchema: z.object({}).strict(),
  execute: () => {
    const now = new Date()
    return {
      iso: now.toISOString(),
      timestamp: now.getTime(),
      timeZone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }
  },
}

const mathEvalTool: ToolDefinition = {
  name: 'mathEval',
  description:
    'Evaluate a basic arithmetic expression with +, -, *, /, parentheses, and decimals. Local, no eval(), no network.',
  inputSchema: z
    .object({
      expression: z
        .string()
        .min(1)
        .max(256)
        .describe('Arithmetic expression, e.g. "(2 + 3) * 4".'),
    })
    .strict(),
  execute: ({ expression }) => {
    const result = safeArith(expression)
    return { expression, result }
  },
}

const kvStoreLookupTool: ToolDefinition = {
  name: 'kvStoreLookup',
  description:
    'Read a non-sensitive value from the on-device key-value store. Refuses any key that looks credential-shaped.',
  inputSchema: z
    .object({
      key: z
        .string()
        .min(1)
        .max(128)
        .describe('Non-sensitive KV key. Credential-shaped keys are refused.'),
    })
    .strict(),
  execute: async ({ key }) => {
    if (isSensitiveKey(key)) {
      throw new Error(
        `kvStoreLookup: refusing to expose sensitive key "${key}"`,
      )
    }
    const { kvStore } = await import('@/lib/llm-runtime/kv-store')
    const value = await kvStore.get(key)
    return { key, value: value ?? null }
  },
}

/** Built-in tools the registry exposes by default. All zero-network. */
export const BUILTIN_TOOLS: readonly ToolDefinition[] = [
  currentTimeTool,
  mathEvalTool,
  kvStoreLookupTool,
] as const

/**
 * Build a fresh registry pre-populated with the local-first built-ins.
 * Callers can `register(...)` additional tools on top.
 */
export function createDefaultRegistry(): ToolRegistry {
  const reg = new ToolRegistry()
  for (const def of BUILTIN_TOOLS) {
    reg.register(def)
  }
  return reg
}

// ─── Internals ─────────────────────────────────────────────────────────

/**
 * Strict arithmetic evaluator: tokens are limited to digits, operators,
 * and parentheses; recursion implements standard precedence. No eval(),
 * no Function constructor, no string concatenation. Throws on malformed
 * input rather than returning NaN so callers see a clear failure.
 */
function safeArith(expr: string): number {
  const cleaned = expr.replace(/\s+/g, '')
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) {
    throw new Error('mathEval: expression contains unsupported characters')
  }

  let i = 0

  function parseExpression(): number {
    let value = parseTerm()
    while (i < cleaned.length && (cleaned[i] === '+' || cleaned[i] === '-')) {
      const op = cleaned[i++]
      const rhs = parseTerm()
      value = op === '+' ? value + rhs : value - rhs
    }
    return value
  }

  function parseTerm(): number {
    let value = parseFactor()
    while (i < cleaned.length && (cleaned[i] === '*' || cleaned[i] === '/')) {
      const op = cleaned[i++]
      const rhs = parseFactor()
      if (op === '/') {
        if (rhs === 0) throw new Error('mathEval: division by zero')
        value = value / rhs
      } else {
        value = value * rhs
      }
    }
    return value
  }

  function parseFactor(): number {
    if (cleaned[i] === '+') {
      i++
      return parseFactor()
    }
    if (cleaned[i] === '-') {
      i++
      return -parseFactor()
    }
    if (cleaned[i] === '(') {
      i++
      const value = parseExpression()
      if (cleaned[i] !== ')') throw new Error('mathEval: missing closing parenthesis')
      i++
      return value
    }
    return parseNumber()
  }

  function parseNumber(): number {
    const start = i
    while (i < cleaned.length && /[0-9.]/.test(cleaned[i] as string)) i++
    if (start === i) throw new Error('mathEval: expected a number')
    const slice = cleaned.slice(start, i)
    const n = Number(slice)
    if (!Number.isFinite(n)) throw new Error(`mathEval: invalid number "${slice}"`)
    return n
  }

  const value = parseExpression()
  if (i !== cleaned.length) {
    throw new Error(`mathEval: unexpected trailing input at position ${i}`)
  }
  if (!Number.isFinite(value)) throw new Error('mathEval: non-finite result')
  return value
}
