#!/usr/bin/env node
// scripts/agent-replay.mjs
//
// §U — Reproducible agent runs (replay).
//
// Reads a JSONL trace produced by `src/lib/agent/trace.ts` (§H) and
// either:
//
//   1. Pretty-prints the chronology of a single run, or
//   2. Compares two traces and asserts the recorded tool-call sequence
//      is identical (name + input). Exit 1 on divergence — gives
//      bug-reproduction tickets a concrete pass/fail signal.
//
// Usage
//   node scripts/agent-replay.mjs --trace path/to/trace.jsonl
//   node scripts/agent-replay.mjs --trace expected.jsonl --diff actual.jsonl
//
// Why no model re-run?
//   Re-running an agent against a stub model would require importing
//   the TS agent loop from a CLI (heavy: vite/tsconfig/jsdom). The
//   high-leverage replay piece is comparing two recorded tool sequences,
//   which is a pure-data operation. The eval harness in
//   src/lib/agent/__evals__/ already handles "stub model + scripted
//   responses" inside Vitest.
//
// Pure Node stdlib — no third-party deps.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)

function parseArgv(argv) {
  const args = { trace: null, diff: null, json: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--trace') args.trace = argv[++i]
    else if (a === '--diff') args.diff = argv[++i]
    else if (a === '--json') args.json = true
    else if (a === '--help' || a === '-h') {
      printUsage()
      process.exit(0)
    } else {
      console.error(`Unknown argument: ${a}`)
      printUsage()
      process.exit(2)
    }
  }
  return args
}

function printUsage() {
  console.error('usage: agent-replay --trace <file.jsonl> [--diff <other.jsonl>] [--json]')
}

const VALID_KINDS = new Set([
  'run-start',
  'run-end',
  'prompt',
  'tool-call',
  'tool-result',
  'verdict',
  'error',
])

/**
 * Parse and validate a JSONL trace. Each line must be an object with
 * `seq`, `ts`, `runId`, `kind`, `data`. Empty lines are skipped.
 */
export function parseTrace(text, sourceLabel = '<input>') {
  const out = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (ln.trim() === '') continue
    let parsed
    try {
      parsed = JSON.parse(ln)
    } catch (err) {
      throw new Error(
        `${sourceLabel}: line ${i + 1}: not valid JSON: ${err.message}`,
      )
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`${sourceLabel}: line ${i + 1}: expected object, got ${typeof parsed}`)
    }
    for (const f of ['seq', 'ts', 'runId', 'kind', 'data']) {
      if (!(f in parsed)) {
        throw new Error(`${sourceLabel}: line ${i + 1}: missing field "${f}"`)
      }
    }
    if (!VALID_KINDS.has(parsed.kind)) {
      throw new Error(
        `${sourceLabel}: line ${i + 1}: unknown kind "${parsed.kind}"`,
      )
    }
    out.push(parsed)
  }
  return out
}

/** Extract the ordered (toolName, JSON-stringified-input) sequence. */
export function toolCallSequence(events) {
  return events
    .filter((e) => e.kind === 'tool-call')
    .map((e) => ({
      name: typeof e.data?.name === 'string' ? e.data.name : '<unknown>',
      input: stableStringify(e.data?.input ?? null),
    }))
}

/** Deterministic JSON stringification (sorted object keys). */
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  const keys = Object.keys(v).sort()
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') +
    '}'
  )
}

function pretty(events) {
  const byRun = new Map()
  for (const e of events) {
    if (!byRun.has(e.runId)) byRun.set(e.runId, [])
    byRun.get(e.runId).push(e)
  }
  const lines = []
  for (const [runId, runEvents] of byRun) {
    lines.push(`# run ${runId} — ${runEvents.length} events`)
    for (const e of runEvents) {
      const summary = summariseEvent(e)
      lines.push(`  [${String(e.seq).padStart(4)}] ${e.ts} ${e.kind.padEnd(12)} ${summary}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function summariseEvent(e) {
  const d = e.data || {}
  switch (e.kind) {
    case 'tool-call':
      return `${d.name ?? '?'}(${truncate(JSON.stringify(d.input ?? {}), 80)})`
    case 'tool-result':
      return `${d.name ?? '?'} → ${truncate(JSON.stringify(d.output ?? null), 80)}`
    case 'prompt':
      return truncate(typeof d.text === 'string' ? d.text : JSON.stringify(d), 80)
    case 'verdict':
      return `ok=${d.ok ?? '?'} missing=${JSON.stringify(d.missing ?? [])}`
    case 'error':
      return truncate(typeof d.message === 'string' ? d.message : JSON.stringify(d), 80)
    case 'run-start':
      return truncate(typeof d.goal === 'string' ? d.goal : JSON.stringify(d), 80)
    case 'run-end':
      return `ok=${d.ok ?? '?'}`
    default:
      return truncate(JSON.stringify(d), 80)
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function diffSequences(expected, actual) {
  const diffs = []
  const max = Math.max(expected.length, actual.length)
  for (let i = 0; i < max; i++) {
    const e = expected[i]
    const a = actual[i]
    if (!e) {
      diffs.push(`+ [${i}] extra ${a.name}(${a.input})`)
    } else if (!a) {
      diffs.push(`- [${i}] missing ${e.name}(${e.input})`)
    } else if (e.name !== a.name || e.input !== a.input) {
      diffs.push(
        `~ [${i}] expected ${e.name}(${e.input}); got ${a.name}(${a.input})`,
      )
    }
  }
  return diffs
}

async function main() {
  const args = parseArgv(process.argv)
  if (!args.trace) {
    printUsage()
    process.exit(2)
  }
  const expectedText = readFileSync(args.trace, 'utf8')
  const expected = parseTrace(expectedText, args.trace)

  if (args.diff) {
    const actual = parseTrace(readFileSync(args.diff, 'utf8'), args.diff)
    const eSeq = toolCallSequence(expected)
    const aSeq = toolCallSequence(actual)
    const diffs = diffSequences(eSeq, aSeq)
    if (args.json) {
      process.stdout.write(JSON.stringify({ ok: diffs.length === 0, diffs }, null, 2) + '\n')
    } else if (diffs.length === 0) {
      console.log(
        `✓ tool-call sequences match: ${eSeq.length} call(s)`,
      )
    } else {
      console.error(`✗ tool-call sequences diverge (${diffs.length} difference(s)):`)
      for (const d of diffs) console.error(`  ${d}`)
    }
    process.exit(diffs.length === 0 ? 0 : 1)
  }

  if (args.json) {
    process.stdout.write(
      JSON.stringify({ events: expected, toolCalls: toolCallSequence(expected) }, null, 2) + '\n',
    )
  } else {
    process.stdout.write(pretty(expected))
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === __filename
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || err.message || String(err))
    process.exit(2)
  })
}
