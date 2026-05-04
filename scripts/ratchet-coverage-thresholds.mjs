#!/usr/bin/env node
// scripts/ratchet-coverage-thresholds.mjs
//
// Reads coverage/coverage-summary.json (produced by
// `npm run test:coverage`) and rewrites the four numeric thresholds in
// vitest.config.ts to floor(actual) for each metric — but only ever
// upward. Never weakens a threshold.
//
// Usage:
//   node scripts/ratchet-coverage-thresholds.mjs              # write
//   node scripts/ratchet-coverage-thresholds.mjs --check      # exit 1 if would-change
//   node scripts/ratchet-coverage-thresholds.mjs --dry-run    # print diff only
//
// Exit codes:
//   0  no change needed (or write succeeded)
//   1  --check mode and a ratchet IS available
//   2  coverage report missing or malformed
//
// The script is invoked nightly by the `coverage-dispatch.yml` workflow
// committed by github-actions[bot] via the existing ruleset bypass.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SUMMARY_PATH = resolve(REPO_ROOT, 'coverage/coverage-summary.json');
const CONFIG_PATH = resolve(REPO_ROOT, 'vitest.config.ts');

const args = new Set(process.argv.slice(2));
const CHECK_MODE = args.has('--check');
const DRY_RUN = args.has('--dry-run');

if (!existsSync(SUMMARY_PATH)) {
  console.error(`✗ Coverage summary not found at ${SUMMARY_PATH}.`);
  console.error('  Run `npm run test:coverage` first.');
  process.exit(2);
}
if (!existsSync(CONFIG_PATH)) {
  console.error(`✗ vitest.config.ts not found at ${CONFIG_PATH}.`);
  process.exit(2);
}

let summary;
try {
  summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
} catch (err) {
  console.error(`✗ Could not parse ${SUMMARY_PATH}: ${err.message}`);
  process.exit(2);
}

const total = summary.total;
if (!total) {
  console.error('✗ Coverage summary has no `total` key.');
  process.exit(2);
}

// floor() the actual percentages so we never set the floor *above* what
// CI actually achieves (which would self-fail the next CI run).
const actual = {
  lines:      Math.floor(total.lines.pct),
  functions:  Math.floor(total.functions.pct),
  branches:   Math.floor(total.branches.pct),
  statements: Math.floor(total.statements.pct),
};

const config = readFileSync(CONFIG_PATH, 'utf8');

// Threshold lines look like:   lines: 82,
// We update only inside the thresholds: { ... } block to avoid
// accidentally touching unrelated numeric literals.
const thresholdsBlockRe = /thresholds:\s*\{([\s\S]*?)\},/;
const blockMatch = config.match(thresholdsBlockRe);
if (!blockMatch) {
  console.error('✗ Could not locate `thresholds: { ... }` block in vitest.config.ts.');
  process.exit(2);
}

const oldBlock = blockMatch[1];
const current = {};
for (const key of ['lines', 'functions', 'branches', 'statements']) {
  const m = oldBlock.match(new RegExp(`${key}:\\s*(\\d+)`));
  if (!m) {
    console.error(`✗ Threshold key '${key}' not found in vitest.config.ts.`);
    process.exit(2);
  }
  current[key] = parseInt(m[1], 10);
}

let newBlock = oldBlock;
let changed = false;
const changes = [];
for (const key of ['lines', 'functions', 'branches', 'statements']) {
  const next = Math.max(current[key], actual[key]); // ratchet, never lower
  if (next !== current[key]) {
    newBlock = newBlock.replace(
      new RegExp(`(${key}:\\s*)(\\d+)`),
      `$1${next}`,
    );
    changes.push(`  ${key}: ${current[key]} → ${next}  (actual ${actual[key]})`);
    changed = true;
  }
}

console.log('Coverage actuals (floored):');
for (const k of Object.keys(actual)) {
  console.log(`  ${k.padEnd(11)} ${actual[k]}%   (current floor: ${current[k]}%)`);
}

if (!changed) {
  console.log('\n✓ Floors already at or above current coverage; no ratchet needed.');
  process.exit(0);
}

console.log('\nProposed ratchet:');
for (const line of changes) console.log(line);

if (CHECK_MODE) {
  console.log('\n--check: ratchet IS available — exiting 1.');
  process.exit(1);
}
if (DRY_RUN) {
  console.log('\n--dry-run: not writing.');
  process.exit(0);
}

const newConfig = config.replace(thresholdsBlockRe, `thresholds: {${newBlock}},`);
writeFileSync(CONFIG_PATH, newConfig, 'utf8');
console.log('\n✓ Wrote new thresholds to vitest.config.ts.');
