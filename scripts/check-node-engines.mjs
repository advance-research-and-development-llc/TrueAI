#!/usr/bin/env node
// scripts/check-node-engines.mjs
//
// Walk every direct + transitive dependency in node_modules and report
// any package whose `engines.node` constraint is NOT satisfied by the
// `engines.node` declared in this repo's package.json.
//
// Output is JSON to stdout (machine-readable) and a human summary to
// stderr. Exit codes:
//   0  no incompatibilities found
//   1  one or more incompatibilities (full list on stdout)
//   2  could not run (missing node_modules / package.json)
//
// Pure stdlib — no third-party deps, so it works during partial installs.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

let rootPkg;
try {
  rootPkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'));
} catch (err) {
  console.error(`✗ Cannot read package.json: ${err.message}`);
  process.exit(2);
}

const ourNodeRange = rootPkg.engines?.node ?? '>=24.0.0';

// Minimal semver-range satisfaction: covers the operators actually used
// by ecosystem packages (>=, >, <=, <, =, ^, ~, ||, x-ranges, *).
// We deliberately do NOT pull in `semver` to keep this dep-free.
//
// Strategy: for the practical question "is the runtime version V
// allowed by RANGE?", reduce both to a numeric tuple and compare per
// clause. Returns true on parse failure (conservatively assume
// compatibility rather than reporting noise).
function parseVer(v) {
  const m = String(v).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [parseInt(m[1] || '0', 10), parseInt(m[2] || '0', 10), parseInt(m[3] || '0', 10)];
}
function cmp(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}
function clauseSat(version, clause) {
  clause = clause.trim();
  if (!clause || clause === '*' || clause === 'x' || clause === 'latest') return true;
  // "node" sometimes shows up as 'node'
  if (clause === 'node') return true;
  const m = clause.match(/^(>=|<=|>|<|=|\^|~)?\s*v?(.+)$/);
  if (!m) return true;
  const op = m[1] || '=';
  const target = parseVer(m[2]);
  if (!target) return true;
  const c = cmp(version, target);
  switch (op) {
    case '>=': return c >= 0;
    case '>':  return c > 0;
    case '<=': return c <= 0;
    case '<':  return c < 0;
    case '=':  return c === 0;
    case '^':
      return version[0] === target[0] && c >= 0;
    case '~':
      return version[0] === target[0] && version[1] === target[1] && c >= 0;
    default:   return true;
  }
}
function rangeSat(version, range) {
  if (!range) return true;
  // Disjunction
  return String(range).split('||').some(or => {
    // Tokenise: combine "op" + " " + "version" into "opversion"
    const tokens = or.trim().split(/\s+/).filter(Boolean);
    const merged = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      // If token is just an operator (no version glued on) and the next
      // token starts with a digit, merge them: ">=", "18" → ">=18".
      if (/^(>=|<=|>|<|=|\^|~)$/.test(t) && i + 1 < tokens.length && /^v?\d/.test(tokens[i + 1])) {
        merged.push(t + tokens[i + 1]);
        i++;
      } else {
        merged.push(t);
      }
    }
    return merged.every(c => clauseSat(version, c));
  });
}

// Find the lowest version allowed by `ourNodeRange` so we test from
// the floor — we want to know "does dep X tolerate every Node we
// claim to support?". For ">=24.0.0" the floor is [24,0,0].
function floorOf(range) {
  const m = String(range).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1] || '0', 10), parseInt(m[2] || '0', 10), parseInt(m[3] || '0', 10)];
}
const ourFloor = floorOf(ourNodeRange);

// Walk node_modules — including nested (yarn-style hoisting fallback)
function* walkPackages(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === '.bin' || entry === '.cache') continue;
    const full = join(dir, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (!s.isDirectory()) continue;
    if (entry.startsWith('@')) {
      // scoped: recurse one level
      for (const scoped of readdirSync(full)) {
        const sf = join(full, scoped);
        try {
          if (statSync(sf).isDirectory()) yield sf;
        } catch { /* skip */ }
      }
    } else {
      yield full;
      // nested
      const nested = join(full, 'node_modules');
      if (existsSync(nested)) yield* walkPackages(nested);
    }
  }
}

const NM = resolve(REPO_ROOT, 'node_modules');
if (!existsSync(NM)) {
  console.error('✗ node_modules missing — run `npm ci` first.');
  process.exit(2);
}

const incompat = [];
const seen = new Set();
for (const dir of walkPackages(NM)) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  let pkg;
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { continue; }
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const range = pkg.engines?.node;
  if (!range) continue;
  if (!rangeSat(ourFloor, range)) {
    incompat.push({
      name: pkg.name,
      version: pkg.version,
      requires: range,
      ourFloor: ourFloor.join('.'),
    });
  }
}

console.log(JSON.stringify({
  ourEnginesNode: ourNodeRange,
  testedFloor: ourFloor.join('.'),
  incompatibleCount: incompat.length,
  incompatible: incompat,
}, null, 2));

if (incompat.length > 0) {
  console.error(`✗ ${incompat.length} dependency package(s) declare engines.node incompatible with ${ourNodeRange}:`);
  for (const i of incompat.slice(0, 20)) {
    console.error(`  - ${i.name}@${i.version}  requires ${i.requires}`);
  }
  if (incompat.length > 20) console.error(`  ... and ${incompat.length - 20} more`);
  process.exit(1);
}
console.error(`✓ All ${seen.size} packages declare engines.node compatible with ${ourNodeRange}.`);
process.exit(0);
