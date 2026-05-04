/**
 * §H — Local-only agent telemetry (trace).
 *
 * Provides a structured, ring-buffered JSONL trace of agent runs persisted
 * via the on-device `kvStore`. Visible only to the user (e.g. via Settings
 * → Agent → Show trace). NEVER transmitted off-device.
 *
 * Design points:
 *   1. **Local-only.** Reads and writes go through `kvStore`, the same
 *      IndexedDB-backed store as the rest of the app. No network calls.
 *   2. **Bounded.** A ring buffer with `MAX_ENTRIES` entries keeps the
 *      cost on every agent run constant. Older entries are evicted FIFO.
 *   3. **No leakage.** Trace records carry user prompts and tool I/O; we
 *      strip any field whose key matches the credential-shaped prefixes
 *      that `tool-registry.ts` already pins, mirroring the leak
 *      regression in `kv-store.test.ts`.
 *   4. **Opt-in.** `recordTraceEvent` is a no-op unless `enableTrace()`
 *      has been called this session (or persisted via `setTraceEnabled`).
 */

import { kvStore } from '@/lib/llm-runtime/kv-store'
import { isSensitiveKey } from './tool-registry'

/** kv-store key under which the trace ring buffer lives. */
export const AGENT_TRACE_KEY = '__agent_trace__'
/** kv-store key for the user's enable/disable preference. */
export const AGENT_TRACE_ENABLED_KEY = '__agent_trace_enabled__'

/** Maximum number of events kept in the ring buffer. */
export const MAX_ENTRIES = 500

export type TraceEventKind =
  | 'run-start'
  | 'run-end'
  | 'prompt'
  | 'tool-call'
  | 'tool-result'
  | 'verdict'
  | 'error'

export interface TraceEvent {
  /** Monotonic sequence number assigned at append time. */
  seq: number
  /** ISO-8601 timestamp. */
  ts: string
  /** Logical run id; lets a session correlate events. */
  runId: string
  kind: TraceEventKind
  /** Free-form structured payload. Sensitive keys are stripped. */
  data: Record<string, unknown>
}

let inMemoryEnabled: boolean | null = null

/**
 * Returns whether tracing is currently enabled. Reads the persisted
 * preference once per session and caches it in memory; subsequent
 * `setTraceEnabled` calls update both layers.
 */
export async function isTraceEnabled(): Promise<boolean> {
  if (inMemoryEnabled !== null) return inMemoryEnabled
  const persisted = await kvStore.get<boolean>(AGENT_TRACE_ENABLED_KEY)
  inMemoryEnabled = persisted === true
  return inMemoryEnabled
}

/** Enable tracing for the current session and persist the preference. */
export async function setTraceEnabled(enabled: boolean): Promise<void> {
  inMemoryEnabled = enabled
  await kvStore.set(AGENT_TRACE_ENABLED_KEY, enabled)
}

/** Test-only escape hatch to reset the in-memory cache. */
export function __resetTraceCacheForTests(): void {
  inMemoryEnabled = null
}

/**
 * Append a single event to the ring buffer. No-op when tracing is
 * disabled. Sensitive top-level fields in `data` are scrubbed before
 * persistence.
 */
export async function recordTraceEvent(
  runId: string,
  kind: TraceEventKind,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (!(await isTraceEnabled())) return

  const existing = (await kvStore.get<TraceEvent[]>(AGENT_TRACE_KEY)) ?? []
  const seq = existing.length === 0 ? 1 : existing[existing.length - 1].seq + 1
  const event: TraceEvent = {
    seq,
    ts: new Date().toISOString(),
    runId,
    kind,
    data: scrubSensitive(data),
  }
  const next = existing.concat(event)
  // Ring-buffer eviction: trim from the front so the most recent
  // MAX_ENTRIES survive. We slice once rather than a loop so a caller
  // that imported a huge backlog converges in a single write.
  const trimmed = next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
  await kvStore.set(AGENT_TRACE_KEY, trimmed)
}

/** Read the full trace (oldest → newest). */
export async function readTrace(): Promise<TraceEvent[]> {
  const events = (await kvStore.get<TraceEvent[]>(AGENT_TRACE_KEY)) ?? []
  return events.slice()
}

/** Erase the entire trace. */
export async function clearTrace(): Promise<void> {
  await kvStore.set(AGENT_TRACE_KEY, [])
}

/**
 * Render the trace as JSONL — each event on its own line. Useful for
 * `npm run agent:replay` (§U) and for users exporting their own trace
 * for support.
 */
export async function exportTraceAsJsonl(): Promise<string> {
  const events = await readTrace()
  return events.map((e) => JSON.stringify(e)).join('\n')
}

/**
 * Return a shallow copy of `data` with any top-level credential-shaped
 * key removed. Mirrors `tool-registry.isSensitiveKey` — keeping a single
 * sensitivity policy for the whole agent surface.
 */
function scrubSensitive(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (isSensitiveKey(k)) continue
    out[k] = v
  }
  return out
}
