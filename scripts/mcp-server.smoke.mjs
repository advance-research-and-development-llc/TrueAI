#!/usr/bin/env node
/**
 * Smoke test for scripts/mcp-server.mjs — drives the JSON-RPC stdio
 * protocol through a child process and asserts the responses for
 * initialize / tools/list / tools/call (success + error paths).
 */

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER = join(__dirname, 'mcp-server.mjs')

function startServer() {
  const proc = spawn(process.execPath, [SERVER], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const lines = []
  const waiters = []
  const rl = createInterface({ input: proc.stdout })
  rl.on('line', (line) => {
    if (waiters.length) waiters.shift()(line)
    else lines.push(line)
  })
  const next = () =>
    new Promise((resolve) => {
      if (lines.length) resolve(lines.shift())
      else waiters.push(resolve)
    })
  const send = (msg) => proc.stdin.write(JSON.stringify(msg) + '\n')
  return { proc, send, next }
}

async function main() {
  const { proc, send, next } = startServer()

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  const init = JSON.parse(await next())
  assert.equal(init.id, 1)
  assert.equal(init.result.serverInfo.name, 'trueai-local')
  assert.ok(init.result.capabilities.tools)

  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  const list = JSON.parse(await next())
  assert.equal(list.id, 2)
  const names = list.result.tools.map((t) => t.name).sort()
  assert.deepEqual(names, ['currentTime', 'mathEval'])

  send({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'mathEval', arguments: { expression: '(2 + 3) * 4' } },
  })
  const ok = JSON.parse(await next())
  assert.equal(ok.id, 3)
  assert.equal(ok.result.isError, false)
  const payload = JSON.parse(ok.result.content[0].text)
  assert.equal(payload.result, 20)

  send({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'mathEval', arguments: { expression: 'os.exit()' } },
  })
  const refused = JSON.parse(await next())
  assert.equal(refused.id, 4)
  assert.equal(refused.result.isError, true)
  assert.match(refused.result.content[0].text, /unsupported characters/)

  send({
    jsonrpc: '2.0', id: 5, method: 'tools/call',
    params: { name: 'noSuchTool', arguments: {} },
  })
  const unknown = JSON.parse(await next())
  assert.equal(unknown.id, 5)
  assert.equal(unknown.error.code, -32602)

  send({ jsonrpc: '2.0', id: 6, method: 'tools/call',
    params: { name: 'currentTime', arguments: {} } })
  const ct = JSON.parse(await next())
  const ctPayload = JSON.parse(ct.result.content[0].text)
  assert.match(ctPayload.iso, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(typeof ctPayload.timestamp, 'number')

  proc.stdin.end()
  await new Promise((r) => proc.on('exit', r))
  console.log('mcp-server smoke test: 6/6 OK')
}

main().catch((err) => {
  console.error('mcp-server smoke test FAILED:', err)
  process.exit(1)
})
