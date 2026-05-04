#!/usr/bin/env node
// scripts/check-agent-frontmatter.mjs
//
// Validate every .github/agents/*.agent.md file (and the legacy
// my-agent.agent.md) carries the required YAML front-matter:
//
//   ---
//   name: <slug>
//   description: <one-line summary>
//   ---
//
// Why
//   Agent CLIs (Claude Code, Codex CLI, GitHub Copilot picker) route
//   @<name> mentions to the file whose front-matter `name` matches.
//   A typo or a missing field silently breaks routing — issues just
//   never land at the intended teammate. This linter makes that a
//   loud failure.
//
// What it checks
//   - File starts with `---` on line 1 followed by a closing `---`.
//   - The block contains a non-empty `name:` line.
//   - The block contains a non-empty `description:` line.
//   - `name` is unique across all agent files (no two agents share
//     a routable handle).
//   - The filename's stem ends with `.agent.md` and the slug
//     (everything before `.agent.md`) is consistent with `name` —
//     either equal, OR the filename is the legacy `my-agent.agent.md`.
//
// Output
//   stdout: human-readable summary
//   stderr: empty on success; the failure list on failure
//
// Exit codes
//   0  every agent file is well-formed
//   1  one or more violations
//   2  could not run (no .github/agents directory)
//
// Pure Node stdlib — no third-party deps.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const AGENTS_DIR = resolve(REPO_ROOT, '.github/agents')

if (!existsSync(AGENTS_DIR)) {
  console.error(`✗ Cannot find ${AGENTS_DIR}`)
  process.exit(2)
}

const files = readdirSync(AGENTS_DIR)
  .filter((f) => f.endsWith('.agent.md'))
  .map((f) => resolve(AGENTS_DIR, f))

if (files.length === 0) {
  console.log('No *.agent.md files found — nothing to lint.')
  process.exit(0)
}

const violations = []
const seenNames = new Map() // name → file

for (const file of files) {
  const rel = file.slice(REPO_ROOT.length + 1)
  const body = readFileSync(file, 'utf8')

  // Front-matter block: file must start with `---\n`, then a body,
  // then a closing `---` on its own line.
  if (!body.startsWith('---\n') && !body.startsWith('---\r\n')) {
    violations.push(`${rel}: missing opening front-matter delimiter (---) on line 1`)
    continue
  }

  const after = body.slice(4)
  const closeIdx = after.search(/\n---\s*\n/)
  if (closeIdx < 0) {
    violations.push(`${rel}: missing closing front-matter delimiter (---)`)
    continue
  }
  const block = after.slice(0, closeIdx)

  const nameMatch = block.match(/^name:\s*(.+?)\s*$/m)
  const descMatch = block.match(/^description:\s*(.+?)\s*$/m)

  if (!nameMatch || !nameMatch[1]) {
    violations.push(`${rel}: front-matter is missing a non-empty \`name:\` field`)
  }
  if (!descMatch || !descMatch[1]) {
    violations.push(`${rel}: front-matter is missing a non-empty \`description:\` field`)
  }

  if (!nameMatch || !descMatch) continue

  const name = nameMatch[1].trim()
  const description = descMatch[1].trim()

  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    violations.push(`${rel}: \`name: ${name}\` must be lowercase-kebab-case (a-z, 0-9, -)`)
  }
  if (description.length < 16) {
    violations.push(
      `${rel}: \`description\` is suspiciously short (${description.length} chars); aim for one informative line`,
    )
  }

  if (seenNames.has(name)) {
    violations.push(
      `${rel}: duplicate \`name: ${name}\` (also declared in ${seenNames.get(name)})`,
    )
  } else {
    seenNames.set(name, rel)
  }

  // §R — optional permission-scoping fields. Parsed only for shape;
  // enforcement against PR diffs lives in scripts/check-agent-permissions.mjs.
  const allowedPaths = parseYamlList(block, 'allowed_paths')
  const allowedLabels = parseYamlList(block, 'allowed_labels')
  if (allowedPaths !== null) {
    if (allowedPaths.length === 0) {
      violations.push(
        `${rel}: \`allowed_paths\` is declared but empty; either remove the key or list at least one glob`,
      )
    }
    for (const p of allowedPaths) {
      if (typeof p !== 'string' || p.trim() === '') {
        violations.push(`${rel}: \`allowed_paths\` entries must be non-empty strings`)
        break
      }
    }
  }
  if (allowedLabels !== null) {
    if (allowedLabels.length === 0) {
      violations.push(
        `${rel}: \`allowed_labels\` is declared but empty; either remove the key or list at least one label`,
      )
    }
    for (const l of allowedLabels) {
      if (typeof l !== 'string' || l.trim() === '') {
        violations.push(`${rel}: \`allowed_labels\` entries must be non-empty strings`)
        break
      }
    }
  }

  // Filename consistency: prefer <name>.agent.md. Allow the legacy
  // my-agent.agent.md (declared name: bug-fix-teammate) until that
  // file is renamed in a separate PR.
  const stem = basename(file).replace(/\.agent\.md$/, '')
  const isLegacy = stem === 'my-agent'
  if (!isLegacy && stem !== name) {
    violations.push(
      `${rel}: filename stem "${stem}.agent.md" does not match \`name: ${name}\` ` +
        `(expected ${name}.agent.md)`,
    )
  }
}

if (violations.length === 0) {
  console.log(`✓ ${files.length} agent file(s) lint clean:`)
  for (const [name, rel] of [...seenNames.entries()].sort()) {
    console.log(`    ${name.padEnd(20)} ${rel}`)
  }
  process.exit(0)
}

const summary = ['✗ Agent front-matter violations:']
for (const v of violations) summary.push(`  - ${v}`)
const out = summary.join('\n')
console.error(out)
console.log(out)
process.exit(1)

/**
 * Minimal YAML block-list parser sufficient for `allowed_paths:` and
 * `allowed_labels:` style fields. Handles:
 *
 *   key:
 *     - "value-one"
 *     - 'value-two'
 *     - bare-value
 *
 * Returns null if `key:` is absent (so callers can distinguish "not
 * declared" from "declared empty"). Values are returned as strings with
 * surrounding quotes stripped. Indentation is permissive: any
 * positive-indent dash line that follows the key (until a non-list line)
 * is collected.
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
          // Inline flow form `key: [a, b]` — best-effort parse.
          if (inline.startsWith('[') && inline.endsWith(']')) {
            const inner = inline.slice(1, -1).trim()
            if (inner === '') return []
            return inner
              .split(',')
              .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          }
          return null // unsupported scalar form; treat as not-a-list
        }
        inList = true
      }
      continue
    }
    // In-list mode: collect `  - value` rows; stop at the first
    // non-indented, non-dash line.
    if (/^\s*-\s+/.test(raw)) {
      const v = raw.replace(/^\s*-\s+/, '').trim().replace(/^["']|["']$/g, '')
      out.push(v)
      continue
    }
    if (/^\s*$/.test(raw)) continue
    if (/^\S/.test(raw)) break
  }
  return inList ? out : null
}
