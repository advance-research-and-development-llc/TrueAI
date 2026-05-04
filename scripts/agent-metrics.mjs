#!/usr/bin/env node
// scripts/agent-metrics.mjs
//
// Compute per-dispatcher win/loss telemetry for the autonomous fix
// pipeline and write a Markdown report to docs/AGENT_METRICS.md.
//
// This is the **measurement layer** for the agent-upgrade plan: every
// later claim of "improvement" (faster time-to-green, higher merge
// rate, less churn) is benchmarked against the numbers this script
// emits. Pure local-first analytics — no third-party services. The
// only data source is the public GitHub Issues + PRs API via `gh`.
//
// Inputs (env):
//   OWNER            repo owner          (default: advance-research-and-development-llc)
//   REPO             repo name           (default: TrueAI)
//   WINDOW_DAYS      lookback window     (default: 90)
//   GH_TOKEN         passed through to gh
//
// Output: writes docs/AGENT_METRICS.md (overwrites). Designed to run
// as a nightly workflow that opens a PR if the file changed; safe to
// run locally.
//
// Usage (typically invoked by .github/workflows/agent-metrics.yml):
//   node scripts/agent-metrics.mjs

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT = resolve(REPO_ROOT, 'docs/AGENT_METRICS.md');

const OWNER = process.env.OWNER || 'advance-research-and-development-llc';
const REPO  = process.env.REPO  || 'TrueAI';
const SLUG  = `${OWNER}/${REPO}`;
const WINDOW_DAYS = Number.parseInt(process.env.WINDOW_DAYS || '90', 10);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

// Defect classes we track. Each is the secondary label that appears
// alongside `copilot-fix` on a dispatched issue. Keep this list in
// sync with docs/AGENT_OPERATIONS.md §1.
const DEFECT_CLASSES = [
  'lint-error',
  'test-failure',
  'android-lint',
  'dependency-vuln',
  'coverage-gap',
  'compatibility',
  'security',
  'runtime-crash',
];

const AGENT_AUTHORS = new Set([
  'Copilot',
  'copilot-swe-agent[bot]',
  'github-actions[bot]',
  'app/copilot-swe-agent',
]);

function gh(args) {
  try {
    return execSync(`gh ${args}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    process.stderr.write(`gh ${args} failed: ${err.message}\n`);
    return '';
  }
}

function jsonOrEmpty(s) {
  if (!s.trim()) return [];
  try { return JSON.parse(s); }
  catch { return []; }
}

const sinceISO = new Date(Date.now() - WINDOW_DAYS * MS_PER_DAY)
  .toISOString();

// --- Pull recent merged PRs (one query, paginated by gh itself) -----------
// We ask for everything we'll need: who merged, when, which labels,
// the head branch (so we can tell `copilot/fix-*` apart from regular
// branches), and createdAt to compute time-to-green.
const prsRaw = gh(
  `pr list --repo ${SLUG} --state all --limit 500 ` +
  `--search "merged:>=${sinceISO.slice(0, 10)} OR closed:>=${sinceISO.slice(0, 10)}" ` +
  `--json number,title,author,labels,createdAt,closedAt,mergedAt,headRefName,state`
);
const prs = jsonOrEmpty(prsRaw);

function isAgentPR(pr) {
  if (AGENT_AUTHORS.has(pr.author?.login)) return true;
  if (pr.headRefName?.startsWith('copilot/')) return true;
  return false;
}

function defectClass(pr) {
  const labels = (pr.labels || []).map(l => l.name);
  for (const c of DEFECT_CLASSES) if (labels.includes(c)) return c;
  // Branch-name fallback for older PRs predating consistent labelling.
  const m = pr.headRefName?.match(/^copilot\/(?:fix-)?([a-z]+)/);
  if (m) {
    const slug = m[1];
    const remap = {
      codeql: 'security',
      secret: 'security',
      lint: 'lint-error',
      audit: 'lint-error',
      dep: 'dependency-vuln',
      cov: 'coverage-gap',
      compat: 'compatibility',
      android: 'android-lint',
    };
    if (remap[slug]) return remap[slug];
  }
  return 'other';
}

const stats = {};
for (const c of [...DEFECT_CLASSES, 'other']) {
  stats[c] = { merged: 0, closedNoMerge: 0, totalHours: 0, mergedCount: 0 };
}

for (const pr of prs) {
  if (!isAgentPR(pr)) continue;
  const c = defectClass(pr);
  if (!stats[c]) stats[c] = { merged: 0, closedNoMerge: 0, totalHours: 0, mergedCount: 0 };
  if (pr.mergedAt) {
    stats[c].merged++;
    const hrs = (new Date(pr.mergedAt) - new Date(pr.createdAt)) / MS_PER_HOUR;
    if (Number.isFinite(hrs) && hrs >= 0) {
      stats[c].totalHours += hrs;
      stats[c].mergedCount++;
    }
  } else if (pr.state === 'CLOSED') {
    stats[c].closedNoMerge++;
  }
}

const totals = { merged: 0, closedNoMerge: 0, totalHours: 0, mergedCount: 0 };
for (const c of Object.keys(stats)) {
  totals.merged += stats[c].merged;
  totals.closedNoMerge += stats[c].closedNoMerge;
  totals.totalHours += stats[c].totalHours;
  totals.mergedCount += stats[c].mergedCount;
}

function row(c, s) {
  const opened = s.merged + s.closedNoMerge;
  const winRate = opened === 0 ? '—' : `${((s.merged / opened) * 100).toFixed(0)}%`;
  const ttg = s.mergedCount === 0 ? '—' : `${(s.totalHours / s.mergedCount).toFixed(1)}h`;
  return `| \`${c}\` | ${opened} | ${s.merged} | ${s.closedNoMerge} | ${winRate} | ${ttg} |`;
}

const generatedAt = new Date().toISOString();
const md = `# Agent metrics — autonomous fix pipeline

> _Auto-regenerated by [\`scripts/agent-metrics.mjs\`](../scripts/agent-metrics.mjs)._
> _Last generated: \`${generatedAt}\`._
> _Window: last ${WINDOW_DAYS} days (since \`${sinceISO.slice(0, 10)}\`)._
>
> Pure local-first telemetry — no third-party services. Source data is
> the public GitHub PRs API via \`gh\`. Companion to
> [\`AGENT_DASHBOARD.md\`](./AGENT_DASHBOARD.md): the dashboard tracks
> the live queue depth, this file tracks **outcomes over time**.
>
> Do not edit by hand; the next nightly run will overwrite your changes.

## Dispatcher win/loss

A "win" is an agent-authored PR that merged into \`main\`. A "loss" is
an agent-authored PR that was closed without merging. PRs still open
are not counted (they will appear in a future window).

Time-to-green is the wall-clock from PR \`createdAt\` to \`mergedAt\` —
includes review-iteration overhead, not just CI runtime.

| Defect class | Opened | Merged | Closed (unmerged) | Win rate | Median time-to-green |
|---|---:|---:|---:|---:|---:|
${[...DEFECT_CLASSES, 'other'].map(c => row(c, stats[c])).join('\n')}
| **Totals** | **${totals.merged + totals.closedNoMerge}** | **${totals.merged}** | **${totals.closedNoMerge}** | **${(totals.merged + totals.closedNoMerge) === 0 ? '—' : `${((totals.merged / (totals.merged + totals.closedNoMerge)) * 100).toFixed(0)}%`}** | **${totals.mergedCount === 0 ? '—' : `${(totals.totalHours / totals.mergedCount).toFixed(1)}h`}** |

## Definition of done — improvement targets

The agent-upgrade plan declares done when the next nightly regen of
this file shows, relative to the **first** committed version:

- ≥ 25% lift in win rate on **at least three** dispatcher classes that
  had ≥ 5 opened PRs in the prior window (small-sample classes are
  excluded to avoid noise-driven claims).
- ≥ 20% reduction in overall time-to-green.
- No dispatcher class regressing more than 10 percentage points in
  win rate (we don't trade churn-for-churn).

## How to read this

- A high **opened** number with a low **win rate** means the
  dispatcher is firing too eagerly or the prompt fragment in
  [\`PROMPTS.md\`](../.github/copilot/PROMPTS.md) is under-specified.
- A high **time-to-green** with a high **win rate** means the agent
  is succeeding but burning CI cycles on retries — usually a sign
  that the issue body lacks reproduction steps.
- The \`other\` row catches PRs whose head branch did not match a
  known dispatcher prefix; persistent growth there is a signal that
  a new defect class needs its own label and prompt fragment.

See [\`AGENT_OPERATIONS.md\`](./AGENT_OPERATIONS.md) for the runbook
that drives these numbers, and
[\`AGENT_CAPABILITIES.md\`](./AGENT_CAPABILITIES.md) for the index
of every agent-facing surface in this repo.
`;

writeFileSync(OUT, md, 'utf8');
process.stdout.write(`Wrote ${OUT}\n`);
