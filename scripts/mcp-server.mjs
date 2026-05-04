#!/usr/bin/env node
/**
 * TrueAI — Minimal MCP server (stdio, JSON-RPC 2.0)
 *
 * Bridges the project's local-first tool registry (§B) to any MCP-aware
 * client (Claude Desktop, Cursor, Continue, etc.) without pulling in the
 * `@modelcontextprotocol/sdk` package — the on-the-wire protocol is small
 * enough to implement directly and we'd rather not weaken supply-chain
 * surface for a marginal feature.
 *
 * Wiring example for Claude Desktop's `claude_desktop_config.json`:
 *
 *     {
 *       "mcpServers": {
 *         "trueai": {
 *           "command": "node",
 *           "args": ["/abs/path/to/TrueAI/scripts/mcp-server.mjs"]
 *         }
 *       }
 *     }
 *
 * Tools exposed (all zero-network, no eval, no IO beyond the host's clock):
 *
 *   - currentTime  → { iso, timestamp, timeZone }
 *   - mathEval     → { expression, result }
 *
 * Notes:
 *   - kvStoreLookup is intentionally NOT exposed: the KV store lives in
 *     IndexedDB inside the running app; an out-of-process MCP server
 *     cannot read it and we don't want to pretend otherwise.
 *   - Network/credential-gated tools are refused on principle — MCP
 *     clients should call the hosted LLM themselves; this server only
 *     vends safe local primitives.
 */

import { createInterface } from 'node:readline'

const SERVER_NAME = 'trueai-local'
const SERVER_VERSION = '0.1.0'
const PROTOCOL_VERSION = '2024-11-05'

// ---------- Tool implementations (mirror src/lib/agent/tool-registry.ts) ----

function currentTime() {
  const now = new Date()
  return {
    iso: now.toISOString(),
    timestamp: now.getTime(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }
}

function mathEval({ expression }) {
  if (typeof expression !== 'string') {
    throw new Error('mathEval: expression must be a string')
  }
  const cleaned = expression.replace(/\s+/g, '')
  if (cleaned.length === 0 || cleaned.length > 256) {
    throw new Error('mathEval: expression length out of range (1..256)')
  }
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) {
    throw new Error('mathEval: expression contains unsupported characters')
  }
  let i = 0
  const parseNumber = () => {
    const start = i
    while (i < cleaned.length && /[0-9.]/.test(cleaned[i])) i++
    if (start === i) throw new Error('mathEval: expected a number')
    const n = Number(cleaned.slice(start, i))
    if (!Number.isFinite(n)) throw new Error('mathEval: invalid number')
    return n
  }
  const parseFactor = () => {
    if (cleaned[i] === '+') { i++; return parseFactor() }
    if (cleaned[i] === '-') { i++; return -parseFactor() }
    if (cleaned[i] === '(') {
      i++
      const v = parseExpression()
      if (cleaned[i] !== ')') throw new Error('mathEval: missing closing parenthesis')
      i++
      return v
    }
    return parseNumber()
  }
  const parseTerm = () => {
    let v = parseFactor()
    while (i < cleaned.length && (cleaned[i] === '*' || cleaned[i] === '/')) {
      const op = cleaned[i++]
      const r = parseFactor()
      if (op === '/') {
        if (r === 0) throw new Error('mathEval: division by zero')
        v = v / r
      } else v = v * r
    }
    return v
  }
  const parseExpression = () => {
    let v = parseTerm()
    while (i < cleaned.length && (cleaned[i] === '+' || cleaned[i] === '-')) {
      const op = cleaned[i++]
      const r = parseTerm()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  const value = parseExpression()
  if (i !== cleaned.length) throw new Error('mathEval: unexpected trailing input')
  if (!Number.isFinite(value)) throw new Error('mathEval: non-finite result')
  return { expression, result: value }
}

const TOOLS = [
  {
    name: 'currentTime',
    description:
      'Return the current date and time in ISO-8601 form, plus the resolved IANA time zone.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => currentTime(),
  },
  {
    name: 'mathEval',
    description:
      'Evaluate a basic arithmetic expression with +, -, *, /, parentheses, and decimals. Local, no eval(), no network.',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          minLength: 1,
          maxLength: 256,
          description: 'Arithmetic expression, e.g. "(2 + 3) * 4".',
        },
      },
      required: ['expression'],
      additionalProperties: false,
    },
    handler: (args) => mathEval(args ?? {}),
  },
]

// ---------- JSON-RPC framing -----------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n')
}

function ok(id, result) { send({ jsonrpc: '2.0', id, result }) }
function fail(id, code, message, data) {
  send({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } })
}

function handle(req) {
  const { id, method, params } = req
  const isNotification = id === undefined || id === null

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      })

    case 'notifications/initialized':
    case 'initialized':
      return // notification, no response

    case 'tools/list':
      return ok(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name, description, inputSchema,
        })),
      })

    case 'tools/call': {
      const name = params?.name
      const args = params?.arguments ?? {}
      const tool = TOOLS.find((t) => t.name === name)
      if (!tool) {
        return fail(id, -32602, `Unknown tool: ${name}`)
      }
      try {
        const value = tool.handler(args)
        return ok(id, {
          content: [{ type: 'text', text: JSON.stringify(value) }],
          isError: false,
        })
      } catch (err) {
        return ok(id, {
          content: [{ type: 'text', text: String(err?.message ?? err) }],
          isError: true,
        })
      }
    }

    case 'ping':
      return ok(id, {})

    default:
      if (!isNotification) fail(id, -32601, `Method not found: ${method}`)
  }
}

// ---------- Wire up stdio ---------------------------------------------------

const rl = createInterface({ input: process.stdin, terminal: false })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let req
  try {
    req = JSON.parse(trimmed)
  } catch {
    fail(null, -32700, 'Parse error')
    return
  }
  try {
    handle(req)
  } catch (err) {
    fail(req?.id ?? null, -32603, `Internal error: ${String(err?.message ?? err)}`)
  }
})

rl.on('close', () => process.exit(0))
