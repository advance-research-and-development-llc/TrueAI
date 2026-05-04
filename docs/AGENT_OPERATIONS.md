# Agent Operations Runbook

> **Operator's guide to the autonomous error/issue/coverage remediation
> pipeline.** Read this when triaging the `copilot-fix` queue, when a
> dispatcher misbehaves, when an autonomous merge needs to be rolled
> back, or when adding a new defect class.

This runbook documents the wiring, not the *why* — for the design
rationale see the implementation PR and
[`.github/copilot/AGENT_RUNTIME.md`](../.github/copilot/AGENT_RUNTIME.md).

---

## 1. The `copilot-fix` queue

Every dispatcher creates issues with the **`copilot-fix`** label and
assigns them to **@copilot**. To see the open queue:

```bash
gh issue list --repo advance-research-and-development-llc/TrueAI \
  --label copilot-fix --state open --limit 50
```

Or via the GitHub UI:
<https://github.com/advance-research-and-development-llc/TrueAI/issues?q=is%3Aissue+is%3Aopen+label%3Acopilot-fix>

### Secondary labels (always present alongside `copilot-fix`)

| Label | Source | Prompt fragment |
|---|---|---|
| `lint-error` | `auto-lint-fix.yml` | `fix-lint` |
| `test-failure` | `test-failure-autofix.yml` | `fix-test-failure` |
| `android-lint` | `android-audit.yml` | `fix-android-lint` |
| `dependency-vuln` | `dependency-scan.yml` | `dep-vuln-bump` |
| `coverage-gap` | `coverage-dispatch.yml` | `coverage-gap-fill` |
| `compatibility` | `compatibility-matrix.yml` | `fix-compatibility` |
| `security` (+ optionally `runtime-crash`) | `codeql-autofix.yml` / `secret-scanning-autofix.yml` / `bug-report-from-logs.yml` | `fix-codeql` / `fix-secret-leak` / `fix-test-failure` |

### Risk labels (assigned to PRs, not issues)

`pr-risk-label.yml` adds exactly one of `risk:trivial`, `risk:low`,
`risk:medium`, `risk:high` to every PR. `auto-merge.yml` refuses to
enable auto-merge on `risk:high` (governance / credential / overrides
diffs). The CODEOWNERS approval requirement from
`.github/rulesets/protect-default-branch.json` applies to **every** PR
regardless of risk label.

---

## 2. Manually invoking a dispatcher

All scheduled dispatchers also accept `workflow_dispatch`:

| Dispatcher | Manual trigger |
|---|---|
| Coverage gap dispatch | `gh workflow run coverage-dispatch.yml` |
| Dependency scan | `gh workflow run dependency-scan.yml` |
| Compatibility matrix | `gh workflow run compatibility-matrix.yml -f fail-on-finding=true` |
| Android Lint audit | `gh workflow run android-audit.yml` |
| Auto bug-fix | `gh workflow run auto-bugfix.yml -f dry_run=true` |
| Scheduled audit | `gh workflow run scheduled-audit.yml` |

CodeQL and Secret-Scanning dispatchers are **event-only**: they fire
on `code_scanning_alert` and `secret_scanning_alert`. To force a
re-evaluation, dismiss & re-open the underlying alert.

---

## 3. Silencing a false positive (without disabling the rule)

The standing rule from `copilot-instructions.md` is *never disable a
linter rule globally to silence one false positive*. Preferred order:

1. **Refactor the offending code** so the rule no longer triggers.
2. **Inline disable** with a comment that includes the rule id AND a
   one-line justification, e.g.
   ```ts
   // eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party type lacks generics, see #123
   ```
3. **Per-file disable at the top of the file** if the file is
   inherently exempt (e.g. a generated file).
4. **Project-level rule downgrade** (`error → warn`) only with a
   migration plan in the PR description and CODEOWNERS sign-off.

For Android Lint, prefer `lint.xml` with a comment over `tools:ignore`.

For CodeQL, dismiss the alert in the Security tab with one of:
- *False positive* (with text explanation),
- *Used in tests* (only for test-only paths),
- *Won't fix* (requires CODEOWNERS approval — paste the dismissal
  text into the issue before closing).

---

## 4. Resuming a stalled agent PR

Symptoms:
- PR is open, last commit is `chore: auto-fix ESLint violations` or
  similar bot commit, and the agent hasn't pushed in > 24 h.
- CI keeps failing on the same step across retries.

Action:
1. Comment `@copilot please continue` on the PR. The agent picks up
   the prompt and resumes.
2. If CI is failing on something the agent can't see in its sandbox
   (e.g. the firewall blocked a download), check
   `Settings → Copilot → Coding agent → Firewall` and add the host to
   the allowlist documented in
   [`.github/copilot/AGENT_RUNTIME.md`](../.github/copilot/AGENT_RUNTIME.md).
3. As a last resort, close the PR and re-open the underlying issue
   with `@copilot please retry from scratch` — a fresh branch will be
   opened.

---

## 5. Rolling back an autonomous merge

Autonomous merges happen only when:
- the PR was authored by a trusted bot,
- the PR is **not** labelled `risk:high`,
- all required status checks are green,
- CODEOWNERS approval has landed.

If the post-merge state is broken:

```bash
# Find the merge commit
git log --merges --first-parent main -n 5 --oneline

# Revert it (creates a follow-up PR via the bot)
gh pr create --base main --head revert/<sha> \
  --title "Revert: <original title>" \
  --body "Reverts #<original PR>. Reason: <one line>."
```

The revert PR itself runs through the full risk classifier; if the
revert touches the same protected paths, it will also be `risk:high`
and require manual approval — which is intentional, the operator has
to ack rolling back.

---

## 6. Adding a new defect class

1. Add a prompt fragment to
   [`.github/copilot/PROMPTS.md`](../.github/copilot/PROMPTS.md).
2. Add the matching label to the `Ensure required labels exist` step
   in [`.github/actions/dispatch-fix-issue/action.yml`](../.github/actions/dispatch-fix-issue/action.yml).
3. Create a new dispatcher workflow under `.github/workflows/` that
   calls the composite. Use one of the existing dispatchers as a
   template (`secret-scanning-autofix.yml` is the smallest).
4. Add a verification branch in
   [`.github/workflows/fix-verification.yml`](../.github/workflows/fix-verification.yml)
   so closed issues of this class get re-checked.
5. Add the new label/source row to **§ 1 Secondary labels** above.
6. Update [`copilot-instructions.md`](../.github/copilot-instructions.md)
   § *Auto-fix issue contract*.

---

## 7. Throttling

`dispatch-fix-issue` and the inline scripts in `coverage-dispatch.yml`
and `dependency-scan.yml` enforce a soft cap of **25 open
`copilot-fix` issues**. New findings beyond the cap are dropped (the
next scheduled run will pick them up once the queue drains).

Operator override: bump the `throttle-cap` input on a per-call basis
or temporarily re-run a dispatcher with `workflow_dispatch` after
manually closing stale issues:

```bash
gh issue list --repo $REPO --label copilot-fix --state open \
  --search 'updated:<2026-04-01' --json number --jq '.[].number' \
  | xargs -I{} gh issue close {} --repo $REPO --comment "Stale; re-open if still relevant."
```

---

## 7b. Prior-attempts tracking and escalation to `human-only`

Every `dispatch-fix-issue` invocation that *reuses* an existing issue
(via the dedup or reopen paths) now walks the issue's timeline,
counts cross-referenced PRs that were **closed without merging by an
agent author**, and embeds a `### Prior attempts` section into the
issue body listing each one. Copilot reads this on its next session
start and is told explicitly **not** to repeat the failed approach.

A "failed attempt" requires both:

- PR `state == CLOSED` and `merged == false`, **and**
- PR `author.login` matches `Copilot`, `copilot-swe-agent[bot]`, or
  `github-actions[bot]`.

PRs closed by an operator (manual triage) or merged successfully are
not counted, so the threshold reflects genuine agent failures.

### Escalation threshold

When the failed-attempt count reaches the `escalate-after` input
(default **3**), the dispatcher:

1. Applies the `human-only` label (auto-created on first use, red).
2. Removes the `copilot` assignee (best-effort; non-fatal if absent).
3. Appends an `### ⛔ Escalation — manual triage required` section to
   the body explaining the threshold and the maintainer next-steps.
4. Comments on the issue and emits `action=escalate` as the action
   output.

The `human-only` label is the canonical "do not assign Copilot"
marker; downstream dispatchers should treat it as a hard skip.

### Operator workflow on escalation

1. Read the prior-attempt PRs listed in the issue body. They almost
   always share a root cause — missing context, broken test infra,
   ambiguous requirements, or a CodeQL false positive.
2. Either:
   - Fix the shared blocker (add fixtures, clarify the prompt
     fragment in `PROMPTS.md`, etc.) and **remove the `human-only`
     label** — the next scheduled scan will re-detect and re-dispatch
     normally. The attempt counter does not auto-reset; it counts
     across the full lifetime of the issue, so a successful merge is
     required to bring it back to zero.
   - Close the issue as wont-fix if the finding is a false positive,
     and add a silencing entry per §3.

### Disabling escalation per-call

Pass `escalate-after: '0'` (or empty) on a specific dispatcher
invocation to disable the gate. This is rarely needed — the cap is
designed to bound waste, not to suppress genuine fixes.

---

## 8. Health checks

```bash
# All dispatchers + agent infra in one pass
scripts/verify-owner-setup.sh --owner advance-research-and-development-llc --repo TrueAI

# Coverage trend (last 14 days)
gh run list --workflow=coverage-dispatch.yml --limit 14 --json conclusion,createdAt

# Most recent agent activity
gh issue list --repo $REPO --label copilot-fix --sort updated --limit 10
```

---

## 9. Known limitations

- **CodeQL re-verification:** `fix-verification.yml` cannot re-trigger
  CodeQL on demand. Verification relies on the next scheduled CodeQL
  run (`codeql.yml`, weekly) re-opening the alert.
- **Secret scanning re-verification:** same limitation — relies on
  GitHub re-detecting the secret if it persists.
- **Android Lint per-rule dispatch:** the existing `android-audit.yml`
  rolls all errors into one issue per audit. Per-rule dispatch is
  tracked as a follow-up; dispatching one issue per rule risks
  flooding the queue when a new lint rule lands.
- **Mutation testing (Stryker), Android JaCoCo, Maestro emulator
  coverage:** scaffolded as plan items but not enabled — each adds
  significant CI minutes and is best landed as its own PR with
  before/after benchmarks.
