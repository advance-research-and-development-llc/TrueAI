#!/usr/bin/env node
/**
 * Smoke test for scripts/mcp-client.mjs — connects to our own §E
 * MCP server (scripts/mcp-server.mjs) and exercises the full
 * round-trip: connect, listTools, callTool (success), callTool
 * (refused-character error path), close.
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'
import { McpClient } from './mcp-client.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER = join(__dirname, 'mcp-server.mjs')

async function main() {
  const client = new McpClient({
    command: process.execPath,
    args: [SERVER],
    timeoutMs: 5_000,
  })

  const info = await client.connect()
  assert.equal(info.name, 'trueai-local')

  const tools = await client.listTools()
  const names = tools.map((t) => t.name).sort()
  assert.deepEqual(names, ['currentTime', 'mathEval'])

  const ok = await client.callTool('mathEval', { expression: '(2+3)*4' })
  assert.equal(ok.isError, false)
  const okPayload = JSON.parse(ok.content[0].text)
  assert.equal(okPayload.result, 20)

  const bad = await client.callTool('mathEval', { expression: 'os.exit()' })
  assert.equal(bad.isError, true)
  assert.match(bad.content[0].text, /unsupported characters/)

  let unknownErr
  try {
    await client.callTool('noSuchTool', {})
  } catch (err) {
    unknownErr = err
  }
  assert.ok(unknownErr, 'expected callTool on unknown tool to reject')
  assert.equal(unknownErr.code, -32602)

  await client.close()
  console.log('mcp-client smoke test: 5/5 OK')
}

main().catch((err) => {
  console.error('mcp-client smoke test FAILED:', err)
  process.exit(1)
})
