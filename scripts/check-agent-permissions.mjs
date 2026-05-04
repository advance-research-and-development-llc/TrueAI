#!/usr/bin/env node
// scripts/check-agent-permissions.mjs
//
// §R — Per-agent path / label authorisation gate.
//
// Validates that the files changed by a PR routed to a given agent fall
// inside that agent's `allowed_paths` glob list (declared in the agent's
// front-matter). Optionally also validates a list of labels against
// `allowed_labels`. Refuses to run an agent that has no `allowed_paths`
// declared — the lack of declaration is the failure mode (fail closed).
//
// Usage
//   node scripts/check-agent-permissions.mjs --agent <name> [--paths-from -|<file>] [--labels lbl,lbl,...]
//
//   --agent <name>          Required. Slug from a .github/agents/*.agent.md
//                           front-matter `name:` field.
//   --paths-from -          Read changed paths from stdin (one per line).
//   --paths-from <file>     Read changed paths from a file, one per line.
//   --paths a,b,c           Inline comma-separated list (alt to --paths-from).
//   --labels lbl1,lbl2      Inline comma-separated list of PR labels.
//
// CI usage
//   git diff --name-only origin/main...HEAD | \
//     node scripts/check-agent-permissions.mjs --agent android-doctor --paths-from -
//
// Exit codes
//   0  every changed path is authorised (and any labels are authorised)
//   1  one or more violations
//   2  could not run (agent not found, no allowed_paths, etc.)
//
// Pure Node stdlib — no third-party deps.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '..')
const AGENTS_DIR = resolve(REPO_ROOT, '.github/agents')

function parseArgv(argv) {
  const args = { agent: null, pathsFrom: null, paths: null, labels: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--agent') args.agent = argv[++i]
    else if (a === '--paths-from') args.pathsFrom = argv[++i]
    else if (a === '--paths') args.paths = argv[++i]
    else if (a === '--labels') args.labels = argv[++i]
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
  console.error(
    'usage: check-agent-permissions --agent <name> [--paths-from -|<file>|--paths a,b,c] [--labels l1,l2]',
  )
}

async function readPaths(args) {
  if (args.paths) {
    return args.paths
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (args.pathsFrom === '-') {
    const raw = await readStdin()
    return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  }
  if (args.pathsFrom) {
    return readFileSync(args.pathsFrom, 'utf8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function readStdin() {
  return new Promise((res) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => res(data))
    if (process.stdin.isTTY) res('')
  })
}

function loadAgents() {
  if (!existsSync(AGENTS_DIR)) {
    console.error(`✗ Cannot find ${AGENTS_DIR}`)
    process.exit(2)
  }
  const files = readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.agent.md'))
    .map((f) => resolve(AGENTS_DIR, f))
  const agents = []
  for (const file of files) {
    const body = readFileSync(file, 'utf8')
    if (!body.startsWith('---\n') && !body.startsWith('---\r\n')) continue
    const after = body.slice(4)
    const closeIdx = after.search(/\n---\s*\n/)
    if (closeIdx < 0) continue
    const block = after.slice(0, closeIdx)
    const name = (block.match(/^name:\s*(.+?)\s*$/m) || [])[1]
    if (!name) continue
    agents.push({
      name: name.trim(),
      file: file.slice(REPO_ROOT.length + 1),
      allowedPaths: parseYamlList(block, 'allowed_paths'),
      allowedLabels: parseYamlList(block, 'allowed_labels'),
    })
  }
  return agents
}

/**
 * Convert a glob ("src/**", "android/app/build.gradle", "*.md") to an
 * anchored RegExp. Supports `**` (any segments incl. zero), `*` (any
 * chars excluding `/`), and `?` (single char). Other regex metacharacters
 * are escaped. POSIX paths only — callers normalise backslashes upstream.
 */
export function globToRegExp(glob) {
  let re = '^'
  let i = 0
  while (i < glob.length) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      // `**/` — zero or more segments. `**` alone — match anything.
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?'
        i += 3
      } else {
        re += '.*'
        i += 2
      }
    } else if (c === '*') {
      re += '[^/]*'
      i++
    } else if (c === '?') {
      re += '[^/]'
      i++
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      re += '\\' + c
      i++
    } else {
      re += c
      i++
    }
  }
  re += '$'
  return new RegExp(re)
}

function pathMatches(path, globs) {
  return globs.some((g) => globToRegExp(g).test(path))
}

async function main() {
  const args = parseArgv(process.argv)
  if (!args.agent) {
    printUsage()
    process.exit(2)
  }
  const agents = loadAgents()
  const agent = agents.find((a) => a.name === args.agent)
  if (!agent) {
    console.error(`✗ No agent named "${args.agent}" found in ${AGENTS_DIR}`)
    console.error(`  Known: ${agents.map((a) => a.name).sort().join(', ')}`)
    process.exit(2)
  }

  const paths = await readPaths(args)
  const labels = args.labels
    ? args.labels.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const violations = []

  if (!agent.allowedPaths || agent.allowedPaths.length === 0) {
    violations.push(
      `agent "${agent.name}" (${agent.file}) declares no \`allowed_paths\` — refusing to authorise any change. Add an \`allowed_paths\` list to its front-matter.`,
    )
  } else if (paths.length === 0) {
    console.log(`✓ agent "${agent.name}": no changed paths supplied — nothing to check.`)
  } else {
    for (const p of paths) {
      if (!pathMatches(p, agent.allowedPaths)) {
        violations.push(
          `agent "${agent.name}" is not authorised to modify "${p}" (not in allowed_paths)`,
        )
      }
    }
  }

  if (labels.length > 0 && agent.allowedLabels && agent.allowedLabels.length > 0) {
    for (const l of labels) {
      if (!agent.allowedLabels.includes(l)) {
        violations.push(
          `agent "${agent.name}" is not authorised to add label "${l}" (not in allowed_labels)`,
        )
      }
    }
  }

  if (violations.length === 0) {
    if (paths.length > 0) {
      console.log(
        `✓ agent "${agent.name}": ${paths.length} path(s) and ${labels.length} label(s) authorised.`,
      )
    }
    process.exit(0)
  }

  console.error('✗ Agent permission violations:')
  for (const v of violations) console.error(`  - ${v}`)
  process.exit(1)
}

/**
 * Minimal YAML block-list parser; mirrors the helper in
 * scripts/check-agent-frontmatter.mjs. Returns null when the key is
 * absent so the caller can distinguish "undeclared" from "empty".
 */
function parseYamlList(block, key) {
  const lines = block.split(/\r?\n/)
  const keyRe = new RegExp(`^${key}\\s*:\\s*(.*)$`)
  const out = []
  let inList = false
  for (const raw of lines) {
    if (!inList) {
      const m = keyRe.exec(raw)
      if (m) {
        const inline = m[1].trim()
        if (inline.length > 0 && inline !== '|' && inline !== '>') {
          if (inline.startsWith('[') && inline.endsWith(']')) {
            const inner = inline.slice(1, -1).trim()
            if (inner === '') return []
            return inner
              .split(',')
              .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          }
          return null
        }
        inList = true
      }
      continue
    }
    if (/^\s*-\s+/.test(raw)) {
      out.push(raw.replace(/^\s*-\s+/, '').trim().replace(/^["']|["']$/g, ''))
      continue
    }
    if (/^\s*$/.test(raw)) continue
    if (/^\S/.test(raw)) break
  }
  return inList ? out : null
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === __filename
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || err.message || String(err))
    process.exit(2)
  })
}
