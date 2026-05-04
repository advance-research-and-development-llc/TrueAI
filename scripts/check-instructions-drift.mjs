#!/usr/bin/env node
// scripts/check-instructions-drift.mjs
//
// Verify that the dependency-override pins documented in
// `.github/copilot-instructions.md` (and the AGENTS.md digest) match the
// real `overrides` block in `package.json`. The two have drifted in
// the past — this script makes drift a hard CI failure rather than a
// silently broken contract.
//
// What it checks
//   For each entry in `package.json`'s `overrides` block, the
//   instruction docs must contain the literal `<name> <range>` pair
//   (case-insensitive whitespace). If any pin is missing or
//   contradicts the doc, the script exits non-zero with a diff.
//
// Output
//   stdout: human-readable summary, success or diff
//   stderr: nothing on success; the diff on failure (so CI tools that
//           buffer stdout still see the failure cause)
//
// Exit codes
//   0  docs and package.json agree
//   1  drift detected (one or more pins)
//   2  could not run (missing file, malformed JSON)
//
// Pure Node stdlib — no third-party deps, no network calls.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const PKG_PATH = resolve(REPO_ROOT, 'package.json')
const DOC_PATHS = [
  resolve(REPO_ROOT, '.github/copilot-instructions.md'),
  resolve(REPO_ROOT, 'AGENTS.md'),
]

function fail(code, message) {
  console.error(`✗ ${message}`)
  process.exit(code)
}

let pkg
try {
  pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'))
} catch (err) {
  fail(2, `Cannot read ${PKG_PATH}: ${err.message}`)
}

const overrides = pkg.overrides
if (!overrides || typeof overrides !== 'object') {
  console.log('✓ No `overrides` block in package.json — nothing to check.')
  process.exit(0)
}

const docs = []
for (const p of DOC_PATHS) {
  try {
    docs.push({ path: p, body: readFileSync(p, 'utf8') })
  } catch {
    // A doc being absent is OK (e.g. AGENTS.md may not have landed
    // everywhere yet). Drift is only counted against docs that exist.
  }
}

if (docs.length === 0) {
  fail(2, 'No instruction docs found; expected at least one of: ' + DOC_PATHS.join(', '))
}

/**
 * Normalise an override key for matching: `brace-expansion@1` is the
 * actual override target but the docs may say either form. Compare
 * the bare package name (everything before the `@version` suffix) and
 * separately verify the version range is mentioned.
 */
function bareName(key) {
  const at = key.lastIndexOf('@')
  return at > 0 ? key.slice(0, at) : key
}

const findings = []

for (const [key, range] of Object.entries(overrides)) {
  if (typeof range !== 'string') {
    findings.push({
      level: 'error',
      key,
      message: `non-string override target (got ${typeof range}); cannot verify`,
    })
    continue
  }

  const name = bareName(key)
  // Match the package name AND the version range somewhere within the
  // same line. Allows "`path-to-regexp ^8.4.0`" or
  // "`path-to-regexp` `^8.4.0`" or comma-separated lists.
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedRange = range.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lineRe = new RegExp(`${escapedName}[^\\n]*${escapedRange}`)

  for (const doc of docs) {
    if (!doc.body.includes(name)) {
      findings.push({
        level: 'error',
        key,
        doc: doc.path,
        message: `package "${name}" not mentioned in ${relPath(doc.path)}`,
      })
      continue
    }
    if (!lineRe.test(doc.body)) {
      findings.push({
        level: 'error',
        key,
        doc: doc.path,
        message: `pin drift: package.json overrides "${key}" → "${range}", but ${relPath(doc.path)} mentions "${name}" without that range on the same line`,
      })
    }
  }
}

function relPath(abs) {
  return abs.startsWith(REPO_ROOT + '/') ? abs.slice(REPO_ROOT.length + 1) : abs
}

if (findings.length === 0) {
  const summary = Object.entries(overrides)
    .map(([k, v]) => `  ${k} ${v}`)
    .join('\n')
  console.log('✓ Override pins match instruction docs:\n' + summary)
  process.exit(0)
}

const lines = ['✗ Override-pin drift detected:']
for (const f of findings) {
  lines.push(`  - [${f.level}] ${f.message}`)
}
const diff = lines.join('\n')
console.error(diff)
console.log(diff) // also stdout so CI summaries pick it up
process.exit(1)
