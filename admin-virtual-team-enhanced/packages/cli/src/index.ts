#!/usr/bin/env node

import { createInterface } from 'node:readline'
import type { BootstrapAdminInput, BootstrapStatus } from '@trueai/shared'

const DEFAULT_HOST = process.env.TRUEAI_API_HOST ?? 'http://127.0.0.1:3210'

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp()
    process.exit(0)
  }

  if (cmd === 'bootstrap') {
    const host = readFlag(rest, '--host') ?? DEFAULT_HOST
    const username = await prompt('Admin username: ')
    const password = await promptHidden('Admin password (min 12 chars): ')
    const password2 = await promptHidden('Confirm password: ')
    if (password !== password2) {
      console.error('Passwords do not match')
      process.exit(2)
    }
    const input: BootstrapAdminInput = { username, password }
    const res = await fetchJson(`${host}/bootstrap/admin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      console.error(`Bootstrap failed: ${res.status} ${JSON.stringify(res.body)}`)
      process.exit(1)
    }
    console.log('Bootstrap admin created')
    return
  }

  if (cmd === 'status') {
    const host = readFlag(rest, '--host') ?? DEFAULT_HOST
    const res = await fetchJson(`${host}/bootstrap/status`)
    if (!res.ok) {
      console.error(`Status failed: ${res.status} ${JSON.stringify(res.body)}`)
      process.exit(1)
    }
    const status = res.body as BootstrapStatus
    console.log(JSON.stringify(status, null, 2))
    return
  }

  console.error(`Unknown command: ${cmd}`)
  printHelp()
  process.exit(1)
}

function printHelp() {
  console.log(`trueai-team

Commands:
  bootstrap   Create the first admin (bootstrap mode)
  status      Print bootstrap status

Flags:
  --host <url>   teamd host (default: ${DEFAULT_HOST})
`)
}

function readFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name)
  if (idx < 0) return undefined
  return args[idx + 1]
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, ans => {
      rl.close()
      resolve(ans.trim())
    })
  })
}

function promptHidden(question: string): Promise<string> {
  // v1: minimal hidden input. On many terminals this still echoes.
  // Good enough for bootstrap-only; replace with a proper TTY impl later.
  return prompt(question)
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init)
  let body: unknown
  try {
    body = await r.json()
  } catch {
    body = null
  }
  return { ok: r.ok, status: r.status, body }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
