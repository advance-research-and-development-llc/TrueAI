#!/usr/bin/env node
/**
 * TrueAI — Minimal MCP client (Node-only, zero-dep)
 *
 * Plan item §W. Connects to an external MCP server over stdio
 * JSON-RPC 2.0 and exposes a small library + CLI for listing and
 * invoking its tools.
 *
 * Why Node-only?
 *   The TrueAI app itself runs in Capacitor Android / Vite browser
 *   contexts where child_process / stdio is unavailable. This client
 *   is intended for offline workflows: agent-replay scripts, smoke
 *   tests, dev-time inspection of third-party MCP servers, and as a
 *   building block for future server-side dispatchers.
 *
 * Usage as a CLI:
 *
 *   node scripts/mcp-client.mjs --server "node ./scripts/mcp-server.mjs" --list
 *   node scripts/mcp-client.mjs --server "node ./scripts/mcp-server.mjs" \
 *        --call mathEval --args '{"expression":"(2+3)*4"}'
 *
 * Usage as a library:
 *
 *   import { McpClient } from './scripts/mcp-client.mjs'
 *   const c = new McpClient({ command: 'node', args: ['./scripts/mcp-server.mjs'] })
 *   await c.connect()
 *   const tools = await c.listTools()
 *   const result = await c.callTool('mathEval', { expression: '(2+3)*4' })
 *   await c.close()
 */

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const PROTOCOL_VERSION = '2024-11-05'
const CLIENT_NAME = 'trueai-mcp-client'
const CLIENT_VERSION = '0.1.0'
const DEFAULT_TIMEOUT_MS = 10_000

export class McpClient {
  /**
   * @param {{ command: string, args?: string[], env?: Record<string,string>,
   *           cwd?: string, timeoutMs?: number }} opts
   */
  constructor(opts) {
    if (!opts?.command) throw new Error('McpClient: opts.command is required')
    this.opts = opts
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.proc = null
    this.rl = null
    this.nextId = 1
    this.pending = new Map()
    this.connected = false
    this.serverInfo = null
  }

  async connect() {
    if (this.connected) return this.serverInfo
    this.proc = spawn(this.opts.command, this.opts.args ?? [], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, ...(this.opts.env ?? {}) },
      cwd: this.opts.cwd,
    })
    this.proc.on('exit', (code) => {
      this.connected = false
      for (const { reject } of this.pending.values()) {
        reject(new Error(`MCP server exited with code ${code} before responding`))
      }
      this.pending.clear()
    })
    this.rl = createInterface({ input: this.proc.stdout })
    this.rl.on('line', (line) => this._onLine(line))

    const init = await this._request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
    })
    this._notify('notifications/initialized', {})
    this.connected = true
    this.serverInfo = init.serverInfo ?? null
    return this.serverInfo
  }

  async listTools() {
    if (!this.connected) await this.connect()
    const r = await this._request('tools/list', {})
    return r.tools ?? []
  }

  async callTool(name, args = {}) {
    if (!this.connected) await this.connect()
    return this._request('tools/call', { name, arguments: args })
  }

  async close() {
    if (this.proc) {
      try { this.proc.stdin.end() } catch { /* already closed */ }
      await new Promise((resolve) => {
        if (this.proc.exitCode != null) return resolve()
        this.proc.once('exit', () => resolve())
        setTimeout(() => {
          try { this.proc.kill('SIGTERM') } catch { /* already dead */ }
          resolve()
        }, 500).unref()
      })
    }
    this.connected = false
    this.proc = null
    this.rl = null
  }

  _onLine(line) {
    const trimmed = line.trim()
    if (!trimmed) return
    let msg
    try { msg = JSON.parse(trimmed) } catch { return }
    if (msg.id == null) return // server-side notification, ignore
    const handler = this.pending.get(msg.id)
    if (!handler) return
    this.pending.delete(msg.id)
    if (msg.error) {
      const err = new Error(`MCP error ${msg.error.code}: ${msg.error.message}`)
      err.code = msg.error.code
      err.data = msg.error.data
      handler.reject(err)
    } else {
      handler.resolve(msg.result)
    }
  }

  _send(payload) {
    if (!this.proc?.stdin?.writable) {
      throw new Error('McpClient: server stdin is not writable')
    }
    this.proc.stdin.write(JSON.stringify(payload) + '\n')
  }

  _request(method, params) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`MCP request timed out: ${method} (${this.timeoutMs} ms)`))
      }, this.timeoutMs)
      timer.unref?.()
      this.pending.set(id, {
        resolve: (r) => { clearTimeout(timer); resolve(r) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })
      this._send({ jsonrpc: '2.0', id, method, params })
    })
  }

  _notify(method, params) {
    this._send({ jsonrpc: '2.0', method, params })
  }
}

// ---------- CLI -------------------------------------------------------------

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--server') out.server = argv[++i]
    else if (k === '--list') out.list = true
    else if (k === '--call') out.call = argv[++i]
    else if (k === '--args') out.args = argv[++i]
    else if (k === '--timeout') out.timeoutMs = Number(argv[++i])
    else if (k === '--help' || k === '-h') out.help = true
  }
  return out
}

function printHelp() {
  console.log(`
TrueAI MCP client (§W)

  --server "<command>"     command to launch the MCP server
                           (e.g. "node ./scripts/mcp-server.mjs")
  --list                   list tools the server exposes
  --call <toolName>        invoke a tool
  --args '<json>'          JSON arguments for --call (default: {})
  --timeout <ms>           per-request timeout (default: 10000)
  --help                   show this help
`.trimEnd())
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.server || (!args.list && !args.call)) {
    printHelp()
    process.exit(args.help ? 0 : 2)
  }

  const [cmd, ...rest] = args.server.split(/\s+/)
  const client = new McpClient({
    command: cmd,
    args: rest,
    timeoutMs: args.timeoutMs,
  })

  try {
    await client.connect()
    if (args.list) {
      const tools = await client.listTools()
      console.log(JSON.stringify(tools, null, 2))
    }
    if (args.call) {
      const callArgs = args.args ? JSON.parse(args.args) : {}
      const result = await client.callTool(args.call, callArgs)
      console.log(JSON.stringify(result, null, 2))
      if (result?.isError) process.exitCode = 1
    }
  } catch (err) {
    console.error('mcp-client error:', err.message)
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

const isCli = import.meta.url === `file://${process.argv[1]}`
if (isCli) runCli()
