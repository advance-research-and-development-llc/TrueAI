/**
 * §O — `useAgent` React hook.
 *
 * Thin wrapper over §N's `streamTrueAIAgentRun` that owns the
 * `AbortController`, surfaces token / tool-call progress as React
 * state, and (when enabled) records every transition into the §H
 * `kvStore`-backed agent trace.
 *
 * The hook is intentionally narrow:
 *   - No model selection logic — callers pass a `LanguageModel`.
 *   - No history persistence — that is a chat-level concern.
 *   - No retry policy — fail fast and let the UI show the error.
 *
 * Replaces the ad-hoc agent plumbing currently inlined in `App.tsx` /
 * `App-Enhanced.tsx`. Those top-level shells sit at ~25% / ~30% line
 * coverage *because* the agent state is inlined there; extracting it
 * into a standalone hook gives us a coverable seam.
 */

import { useCallback, useRef, useState } from 'react'
import {
  streamTrueAIAgentRun,
  type BuildTrueAIAgentOptions,
} from '@/lib/agent/tool-loop-agent'
import {
  isTraceEnabled,
  recordTraceEvent,
} from '@/lib/agent/trace'

export type AgentRunStatus = 'idle' | 'running' | 'aborted' | 'done' | 'error'

export interface AgentToolEvent {
  /** Stable id from the AI SDK so UIs can dedupe tool-result rows. */
  id: string
  name: string
  /** Input as sent to the tool; undefined while still streaming. */
  input?: unknown
  /** Output once the tool has resolved; undefined while pending. */
  output?: unknown
  /** Error message if the tool rejected. */
  error?: string
}

export interface UseAgentResult {
  /** Current run status. `idle` until `run()` is called. */
  status: AgentRunStatus
  /** Concatenated assistant text accumulated so far this run. */
  text: string
  /** Tool-call rows in the order the model invoked them. */
  toolEvents: AgentToolEvent[]
  /** Last error message, if any. */
  error: string | null
  /** Start a new run. Aborts any in-flight run first. */
  run: (goal: string) => Promise<void>
  /** Abort the in-flight run. No-op when idle. */
  abort: () => void
}

export interface UseAgentOptions extends BuildTrueAIAgentOptions {
  /**
   * Stable run id used to correlate trace events. When omitted, the
   * hook generates a `crypto.randomUUID()` per call to `run()`.
   */
  runId?: string
}

/**
 * React hook that drives a single agent run at a time. The returned
 * `run(goal)` Promise resolves once the stream is fully drained (or
 * the user calls `abort()`). All intermediate state is exposed as
 * regular React state so a chat UI can re-render on every chunk.
 */
export function useAgent(opts: UseAgentOptions): UseAgentResult {
  const [status, setStatus] = useState<AgentRunStatus>('idle')
  const [text, setText] = useState('')
  const [toolEvents, setToolEvents] = useState<AgentToolEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const run = useCallback(
    async (goal: string) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const runId = opts.runId ?? generateRunId()

      setStatus('running')
      setText('')
      setToolEvents([])
      setError(null)

      const tracingOn = await isTraceEnabled()
      if (tracingOn) {
        await recordTraceEvent(runId, 'run-start', { goal })
        await recordTraceEvent(runId, 'prompt', { text: goal })
      }

      try {
        const result = streamTrueAIAgentRun(opts, {
          goal,
          abortSignal: controller.signal,
        })

        for await (const part of result.fullStream) {
          if (controller.signal.aborted) break
          await handlePart(part, {
            tracingOn,
            runId,
            setText,
            setToolEvents,
          })
        }

        if (controller.signal.aborted) {
          setStatus('aborted')
          if (tracingOn) {
            await recordTraceEvent(runId, 'run-end', { ok: false, aborted: true })
          }
          return
        }

        setStatus('done')
        if (tracingOn) {
          await recordTraceEvent(runId, 'run-end', { ok: true })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (controller.signal.aborted) {
          setStatus('aborted')
          if (tracingOn) {
            await recordTraceEvent(runId, 'run-end', { ok: false, aborted: true })
          }
          return
        }
        setError(message)
        setStatus('error')
        if (tracingOn) {
          await recordTraceEvent(runId, 'error', { message })
        }
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null
        }
      }
    },
    [opts],
  )

  return { status, text, toolEvents, error, run, abort }
}

interface PartHandlerCtx {
  tracingOn: boolean
  runId: string
  setText: (updater: (prev: string) => string) => void
  setToolEvents: (updater: (prev: AgentToolEvent[]) => AgentToolEvent[]) => void
}

async function handlePart(part: unknown, ctx: PartHandlerCtx): Promise<void> {
  if (typeof part !== 'object' || part === null) return
  const p = part as { type?: string }
  switch (p.type) {
    case 'text-delta': {
      // The AI SDK's user-facing fullStream emits `{ type: 'text-delta', text }`.
      // Older versions used `delta`; accept both for forward/backward
      // compatibility.
      const tp = p as { text?: string; delta?: string }
      const delta = tp.text ?? tp.delta ?? ''
      ctx.setText((prev) => prev + delta)
      return
    }
    case 'tool-call': {
      const tc = p as { toolCallId?: string; toolName?: string; input?: unknown }
      const id = tc.toolCallId ?? `tc-${Date.now()}`
      const name = tc.toolName ?? '<unknown>'
      ctx.setToolEvents((prev) => [
        ...prev,
        { id, name, input: tc.input },
      ])
      if (ctx.tracingOn) {
        await recordTraceEvent(ctx.runId, 'tool-call', { name, input: tc.input })
      }
      return
    }
    case 'tool-result': {
      const tr = p as { toolCallId?: string; toolName?: string; output?: unknown }
      const id = tr.toolCallId
      const name = tr.toolName ?? '<unknown>'
      ctx.setToolEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, output: tr.output } : e)),
      )
      if (ctx.tracingOn) {
        await recordTraceEvent(ctx.runId, 'tool-result', { name, output: tr.output })
      }
      return
    }
    case 'tool-error': {
      const te = p as { toolCallId?: string; toolName?: string; error?: unknown }
      const id = te.toolCallId
      const name = te.toolName ?? '<unknown>'
      const message =
        te.error instanceof Error ? te.error.message : String(te.error ?? 'error')
      ctx.setToolEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, error: message } : e)),
      )
      if (ctx.tracingOn) {
        await recordTraceEvent(ctx.runId, 'error', { name, message })
      }
      return
    }
    default:
      // Other parts (stream-start, response-metadata, finish, …) are
      // not surfaced to the UI; the chat doesn't need them.
      return
  }
}

function generateRunId(): string {
  // Browsers + jsdom both expose crypto.randomUUID(). Fall back to a
  // timestamp+random hybrid for the few environments without it
  // (some older WebViews); the trace uses runId for grouping only,
  // not for security.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`
}
