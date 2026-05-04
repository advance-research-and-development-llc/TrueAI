# Agent capabilities — index

> One-page index of every agent-facing surface in this repo. Read
> this if you're new to the autonomous-fix pipeline; it links every
> document, script, and workflow that participates in the loop.

## Read first (in order)

1. [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) —
   project conventions every agent task must follow.
2. [`.github/copilot/LEARNINGS.md`](../.github/copilot/LEARNINGS.md) —
   append-only knowledge log; entries are hard constraints unless
   explicitly overridden by a newer entry tagged `SUPERSEDES:`.
3. [`.github/copilot/PROMPTS.md`](../.github/copilot/PROMPTS.md) —
   named prompt fragments embedded into every dispatched fix issue.

## Owner-side runtime configuration

- [`.github/copilot/AGENT_RUNTIME.md`](../.github/copilot/AGENT_RUNTIME.md) —
  runner size (`COPILOT_RUNNER`), firewall allowlist, fine-grained
  PAT scopes (`AGENT_AUTOMATION_TOKEN`, `AGENT_TELEMETRY_TOKEN`),
  ruleset bypass, MCP server pointers.
- [`scripts/verify-owner-setup.sh`](../scripts/verify-owner-setup.sh) —
  one-shot ✅/❌ check of every owner-only toggle.
- [`scripts/configure-rulesets.sh`](../scripts/configure-rulesets.sh) —
  idempotent ruleset patcher (run once as repo admin).

## Operator runbook

- [`docs/AGENT_OPERATIONS.md`](./AGENT_OPERATIONS.md) — queue triage,
  manual dispatch, false-positive silencing, autonomous-merge
  rollback.

## Live state

- [`docs/AGENT_DASHBOARD.md`](./AGENT_DASHBOARD.md) — current
  `copilot-fix` queue depth by defect class. Regenerated nightly by
  [`agent-dashboard.yml`](../.github/workflows/agent-dashboard.yml).
- [`docs/AGENT_METRICS.md`](./AGENT_METRICS.md) — outcomes over time
  (win rate, time-to-green per dispatcher class). Regenerated nightly
  by [`agent-metrics.yml`](../.github/workflows/agent-metrics.yml).
- `.agent/index.json` — machine-readable map of the codebase
  (exports, KV keys, routes, dispatchers, prompt fragments). Read at
  session start to skip rediscovery; regenerated on push to `main` by
  [`code-index.yml`](../.github/workflows/code-index.yml) and at
  session start by `copilot-setup-steps.yml`.

## Dispatcher fleet (workflows that open `copilot-fix` issues)

| Workflow | Defect class label | Prompt fragment |
|---|---|---|
| `auto-lint-fix.yml` | `lint-error` | `fix-lint` |
| `test-failure-autofix.yml` | `test-failure` | `fix-test-failure` |
| `android-audit.yml` | `android-lint` | `fix-android-lint` |
| `dependency-scan.yml` | `dependency-vuln` | `dep-vuln-bump` |
| `coverage-dispatch.yml` | `coverage-gap` | `coverage-gap-fill` |
| `compatibility-matrix.yml` | `compatibility` | `fix-compatibility` |
| `codeql-autofix.yml` | `security` | `fix-codeql` |
| `secret-scanning-autofix.yml` | `security` | `fix-secret-leak` |
| `bug-report-from-logs.yml` | `runtime-crash` | `fix-test-failure` |

All dispatchers route through the
[`dispatch-fix-issue`](../.github/actions/dispatch-fix-issue/action.yml)
composite action, which embeds the named prompt fragment, deduplicates
by title-substring search, and respects a 25-issue throttle cap.

## Self-improvement loop

- [`.github/workflows/learnings-ingest.yml`](../.github/workflows/learnings-ingest.yml) —
  parses `## Lessons learned` from merged PR bodies into
  `LEARNINGS.md`. Skips empty/boilerplate entries; dedupes within a
  recent window; honors `SUPERSEDES:` markers.
- [`scripts/agent-metrics.mjs`](../scripts/agent-metrics.mjs) —
  computes win/loss telemetry. Reading the diff between consecutive
  nightly regens of `AGENT_METRICS.md` is how we know whether a
  prompt-fragment edit actually helped.

## Hard constraints (never violate)

These constraints apply to **every** agent task, regardless of which
dispatcher opened the issue:

- No edits to `LICENSE`, `NOTICE`, copyright headers.
- No weakening of `package.json` `overrides` pins.
- No telemetry, analytics, or third-party network calls added to the
  app (the agent firewall allowlist is a separate surface; see
  `AGENT_RUNTIME.md` §3).
- No edits under `.github/**` unless the issue explicitly authorises
  them.
- No edits to `src/lib/llm-runtime/kv-store.ts` or
  `src/lib/native/secure-storage.ts` unless the issue explicitly
  authorises them — these are credential-storage surfaces and are
  auto-classified `risk:high` (manual approval required).
