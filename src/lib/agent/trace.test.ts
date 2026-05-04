import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  AGENT_TRACE_KEY,
  AGENT_TRACE_ENABLED_KEY,
  MAX_ENTRIES,
  __resetTraceCacheForTests,
  clearTrace,
  exportTraceAsJsonl,
  isTraceEnabled,
  readTrace,
  recordTraceEvent,
  setTraceEnabled,
} from './trace'
import { kvStore } from '@/lib/llm-runtime/kv-store'

beforeEach(async () => {
  __resetTraceCacheForTests()
  await kvStore.set(AGENT_TRACE_KEY, [])
  await kvStore.set(AGENT_TRACE_ENABLED_KEY, false)
})

afterEach(async () => {
  __resetTraceCacheForTests()
})

describe('agent trace', () => {
  it('is disabled by default and recordTraceEvent is a no-op', async () => {
    expect(await isTraceEnabled()).toBe(false)
    await recordTraceEvent('run-1', 'prompt', { text: 'hello' })
    expect(await readTrace()).toEqual([])
  })

  it('persists enable/disable preference and surfaces it on next call', async () => {
    await setTraceEnabled(true)
    expect(await isTraceEnabled()).toBe(true)

    __resetTraceCacheForTests()
    expect(await isTraceEnabled()).toBe(true)

    await setTraceEnabled(false)
    expect(await isTraceEnabled()).toBe(false)
  })

  it('appends events with monotonically increasing seq numbers', async () => {
    await setTraceEnabled(true)

    await recordTraceEvent('run-1', 'run-start', { goal: 'demo' })
    await recordTraceEvent('run-1', 'prompt', { text: 'add 2 and 3' })
    await recordTraceEvent('run-1', 'tool-call', {
      name: 'mathEval',
      input: { expression: '2+3' },
    })
    await recordTraceEvent('run-1', 'tool-result', {
      name: 'mathEval',
      output: { result: 5 },
    })
    await recordTraceEvent('run-1', 'run-end', { ok: true })

    const trace = await readTrace()
    expect(trace.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5])
    expect(trace.map((e) => e.kind)).toEqual([
      'run-start',
      'prompt',
      'tool-call',
      'tool-result',
      'run-end',
    ])
    for (const e of trace) {
      expect(e.runId).toBe('run-1')
      expect(typeof e.ts).toBe('string')
      expect(() => new Date(e.ts).toISOString()).not.toThrow()
    }
  })

  it('strips credential-shaped keys before persistence', async () => {
    await setTraceEnabled(true)
    await recordTraceEvent('run-1', 'tool-call', {
      name: 'evil',
      api_key: 'sk-leak',
      apiKey: 'sk-leak2',
      __llm_runtime_api_key__: 'sk-leak3',
      authToken: 'leak',
      Password: 'leak',
      safeField: 'kept',
    })
    const [event] = await readTrace()
    expect(event.data).toEqual({ name: 'evil', safeField: 'kept' })
    expect(JSON.stringify(event)).not.toContain('sk-leak')
    expect(JSON.stringify(event)).not.toContain('Password')
  })

  it('honours the ring-buffer cap', async () => {
    await setTraceEnabled(true)
    const overflow = MAX_ENTRIES + 12
    for (let i = 0; i < overflow; i++) {
      await recordTraceEvent('run-1', 'prompt', { i })
    }
    const trace = await readTrace()
    expect(trace).toHaveLength(MAX_ENTRIES)
    // Oldest survivor's seq equals total - MAX_ENTRIES + 1.
    expect(trace[0].seq).toBe(overflow - MAX_ENTRIES + 1)
    expect(trace[trace.length - 1].seq).toBe(overflow)
  })

  it('exports as JSONL with one event per line', async () => {
    await setTraceEnabled(true)
    await recordTraceEvent('run-1', 'run-start', { goal: 'x' })
    await recordTraceEvent('run-1', 'run-end', { ok: true })
    const jsonl = await exportTraceAsJsonl()
    const lines = jsonl.split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).kind).toBe('run-start')
    expect(JSON.parse(lines[1]).kind).toBe('run-end')
  })

  it('clearTrace empties the buffer', async () => {
    await setTraceEnabled(true)
    await recordTraceEvent('run-1', 'prompt', { x: 1 })
    expect(await readTrace()).toHaveLength(1)
    await clearTrace()
    expect(await readTrace()).toEqual([])
  })

  it('does NOT write to localStorage with a credential-shaped key (regression)', async () => {
    // Mirrors the regression in src/lib/llm-runtime/kv-store.test.ts:
    // even though we explicitly scrub credential-shaped fields, also
    // confirm the public trace key itself is NOT credential-shaped.
    expect(AGENT_TRACE_KEY.startsWith('__llm_runtime_api_key__')).toBe(false)
    expect(/api[_-]?key|secret|token|password/i.test(AGENT_TRACE_KEY)).toBe(false)
  })
})
