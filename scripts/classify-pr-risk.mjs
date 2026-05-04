#!/usr/bin/env node
// scripts/classify-pr-risk.mjs
//
// Reads the list of changed files (one per line on stdin) and the
// total +/- line counts (env: ADDITIONS, DELETIONS) and prints a
// single risk label to stdout: one of `risk:trivial`, `risk:low`,
// `risk:medium`, `risk:high`.
//
// Decision tree (first match wins):
//
//   high     → any path matches:
//                .github/**         (governance — workflows / rulesets)
//                LICENSE | NOTICE   (legal)
//                src/lib/llm-runtime/kv-store.ts  (credential storage)
//                src/lib/native/secure-storage.ts (credential storage)
//                package.json       (overrides / deps)
//              OR additions+deletions > 500
//
//   medium   → src/lib/** (non-UI logic, hooks, runtime)
//              OR src/App.tsx
//              OR additions+deletions > 100
//
//   low      → src/components/ui/**, src/components/**
//              OR docs/**, *.md
//              OR additions+deletions > 25
//
//   trivial  → typo-class diffs (≤25 lines AND only docs / comments)
//
// Used by `pr-automation.yml` (or a new labeller workflow) to
// auto-label PRs and consumed by `auto-merge.yml` selective-merge gate.

import { stdin } from 'node:process';

const ADDITIONS = parseInt(process.env.ADDITIONS || '0', 10);
const DELETIONS = parseInt(process.env.DELETIONS || '0', 10);
const TOTAL = ADDITIONS + DELETIONS;

const HIGH = [
  /^\.github\//,
  /^LICENSE$/,
  /^NOTICE$/,
  /^src\/lib\/llm-runtime\/kv-store\.ts$/,
  /^src\/lib\/native\/secure-storage\.ts$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^android\/app\/build\.gradle/,
  /^android\/.*\/build\.gradle/,
];

const MEDIUM = [
  /^src\/lib\//,
  /^src\/App\.tsx$/,
  /^android\//,
  /^scripts\//,
];

const LOW = [
  /^src\/components\//,
  /^docs\//,
  /\.md$/,
];

async function readStdin() {
  let data = '';
  for await (const chunk of stdin) data += chunk;
  return data.split('\n').map(s => s.trim()).filter(Boolean);
}

const files = await readStdin();
if (files.length === 0) {
  console.log('risk:trivial');
  process.exit(0);
}

function classify() {
  // High wins on any match or large diff
  if (TOTAL > 500) return 'risk:high';
  for (const f of files) {
    if (HIGH.some(re => re.test(f))) return 'risk:high';
  }
  if (TOTAL > 100) return 'risk:medium';
  for (const f of files) {
    if (MEDIUM.some(re => re.test(f))) return 'risk:medium';
  }
  if (TOTAL > 25) return 'risk:low';
  for (const f of files) {
    if (LOW.some(re => re.test(f))) return 'risk:low';
  }
  // Tiny diff, none of the above paths → trivial
  return 'risk:trivial';
}

console.log(classify());
