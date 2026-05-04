#!/usr/bin/env node
// scripts/classify-pr-risk.mjs
//
// Reads the list of changed files (one per line on stdin) and the
// total +/- line counts (env: ADDITIONS, DELETIONS) and prints one
// or more labels to stdout, **one per line**. The first line is
// always the primary risk class — one of:
//   risk:trivial | risk:low | risk:medium | risk:high
// Subsequent lines are optional **attribute** labels that workflows
// may apply alongside the primary risk class:
//   risk:agent-surface  → touches the agent / Copilot prompt surface
//
// Backward compatibility: callers that only read the first line of
// stdout (`| head -1`) still get the primary risk class as before.
//
// Decision tree (first match wins) for the primary label:
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
// Attribute label `risk:agent-surface` is emitted independently when
// any path matches:
//   .github/agents/**
//   .github/copilot/**             (LEARNINGS / PROMPTS / AGENT_RUNTIME)
//   .github/copilot-instructions.md
//   AGENTS.md
//   src/lib/agent/**
//   src/lib/llm-runtime/ai-sdk/**
//
// Used by `pr-risk-label.yml` to auto-label PRs and consumed by
// `auto-merge.yml`'s selective-merge gate.
//
// Self-test: run `node scripts/classify-pr-risk.mjs --self-test` to
// exercise a representative set of fixtures. Exits 0 on success, 1 on
// failure. Pure stdlib — no test runner needed.

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

// Attribute paths — an additional `risk:agent-surface` label is
// emitted on top of the primary risk class when any of these match.
// Reviewers / auto-merge can then refuse independently of risk:high.
const AGENT_SURFACE = [
  /^\.github\/agents\//,
  /^\.github\/copilot\//,
  /^\.github\/copilot-instructions\.md$/,
  /^AGENTS\.md$/,
  /^src\/lib\/agent\//,
  /^src\/lib\/llm-runtime\/ai-sdk\//,
];

function classify(files, total) {
  if (total > 500) return 'risk:high';
  for (const f of files) {
    if (HIGH.some((re) => re.test(f))) return 'risk:high';
  }
  if (total > 100) return 'risk:medium';
  for (const f of files) {
    if (MEDIUM.some((re) => re.test(f))) return 'risk:medium';
  }
  if (total > 25) return 'risk:low';
  for (const f of files) {
    if (LOW.some((re) => re.test(f))) return 'risk:low';
  }
  return 'risk:trivial';
}

function attributes(files) {
  const out = [];
  if (files.some((f) => AGENT_SURFACE.some((re) => re.test(f)))) {
    out.push('risk:agent-surface');
  }
  return out;
}

function emit(files, total) {
  const labels = [classify(files, total), ...attributes(files)];
  return [...new Set(labels)];
}

// --- self-test --------------------------------------------------------------
if (process.argv.includes('--self-test')) {
  const cases = [
    { name: 'empty diff',
      files: [], total: 0,
      want: ['risk:trivial'] },
    { name: 'docs typo',
      files: ['README.md'], total: 4,
      want: ['risk:low'] },
    { name: 'medium docs diff',
      files: ['README.md'], total: 30,
      want: ['risk:low'] },
    { name: 'ui-only change',
      files: ['src/components/Button.tsx'], total: 50,
      want: ['risk:low'] },
    { name: 'src/lib refactor',
      files: ['src/lib/utils.ts'], total: 40,
      want: ['risk:medium'] },
    { name: 'oversized diff',
      files: ['src/components/Button.tsx'], total: 600,
      want: ['risk:high'] },
    { name: 'package.json bump',
      files: ['package.json'], total: 4,
      want: ['risk:high'] },
    { name: 'workflow edit',
      files: ['.github/workflows/ci.yml'], total: 4,
      want: ['risk:high'] },
    { name: 'agent surface only — sub-agents',
      files: ['.github/agents/coverage-improver.agent.md'], total: 80,
      want: ['risk:high', 'risk:agent-surface'] },
    { name: 'agent surface — runtime',
      files: ['src/lib/agent/tool-registry.ts'], total: 40,
      want: ['risk:medium', 'risk:agent-surface'] },
    { name: 'agent surface — root contract',
      files: ['AGENTS.md'], total: 50,
      want: ['risk:low', 'risk:agent-surface'] },
    { name: 'agent surface — copilot instructions',
      files: ['.github/copilot-instructions.md'], total: 5,
      want: ['risk:high', 'risk:agent-surface'] },
    { name: 'mixed agent + ui',
      files: ['src/lib/agent/critic.ts', 'src/components/Chat.tsx'], total: 120,
      want: ['risk:medium', 'risk:agent-surface'] },
  ];

  let failed = 0;
  for (const c of cases) {
    const got = emit(c.files, c.total);
    const ok = got.length === c.want.length && got.every((l, i) => l === c.want[i]);
    if (!ok) {
      failed++;
      console.error(`✗ ${c.name}`);
      console.error(`    files=${JSON.stringify(c.files)} total=${c.total}`);
      console.error(`    want=${JSON.stringify(c.want)}`);
      console.error(`    got =${JSON.stringify(got)}`);
    } else {
      console.log(`✓ ${c.name} → ${got.join(', ')}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} / ${cases.length} fixture(s) failed.`);
    process.exit(1);
  }
  console.log(`\n${cases.length} fixtures passed.`);
  process.exit(0);
}

// --- normal mode ------------------------------------------------------------

async function readStdin() {
  let data = '';
  for await (const chunk of stdin) data += chunk;
  return data.split('\n').map((s) => s.trim()).filter(Boolean);
}

const files = await readStdin();
if (files.length === 0) {
  console.log('risk:trivial');
  process.exit(0);
}

for (const label of emit(files, TOTAL)) console.log(label);
