# Canonical agent prompt fragments

> Reusable prompt blocks that every dispatcher workflow embeds in the
> `## Instructions for Copilot agent` section of the issues it creates.
> Centralising them here means a future change (e.g. tightening a
> constraint, renaming a script) lands in **one** place instead of being
> copy-pasted across `codeql-autofix.yml`, `auto-lint-fix.yml`,
> `android-audit.yml`, `dependency-scan.yml`, `coverage-dispatch.yml`,
> etc.
>
> Workflows reference fragments by name. The composite action at
> `.github/actions/dispatch-fix-issue/action.yml` reads this file and
> stamps the requested fragment into the generated issue body.

---

## Universal hard constraints (always included)

Every fix issue must reproduce these constraints verbatim. Do not
inline a shorter version — the full list is the contract:

```
- [ ] `npm ci` succeeds
- [ ] `npm run lint` exits 0 (no new errors)
- [ ] `npm run build:dev` succeeds
- [ ] `npm test` passes — no newly failing tests
- [ ] CodeQL must not introduce new alerts
- [ ] `package.json` `overrides` pins (`path-to-regexp`, `postcss`,
      `lodash`, `brace-expansion@1`) must NOT be weakened
- [ ] No telemetry, analytics, or third-party network calls added
- [ ] `LICENSE`, `NOTICE`, and copyright headers are preserved
- [ ] No edits under `.github/**` unless this issue explicitly asks for them
```

---

## Fragment: `fix-codeql`

Use for `code_scanning_alert` dispatches.

```
1. Read the alert at `${ALERT_HTML_URL}` and the file at `${FILE}:${LINE}`.
2. Fix only the identified vulnerability — do not refactor unrelated code.
3. If the fix touches sanitisation/escaping, also add a regression test in
   the same file's `*.test.ts(x)` covering the malicious input shape.
4. Use branch name: `copilot/fix-codeql-${ALERT_NUMBER}-${RULE_SLUG}`.
5. Run `npm run lint`, `npm run build:dev`, and `npm test` before opening the PR.
6. Fill in the `## Lessons learned` section of the PR description with the
   root cause class (e.g. unsafe-html, log-injection, regex-DoS).
```

## Fragment: `fix-lint`

Use for ESLint `--fix` residue and the warnings-first plugin expansion
(`jsx-a11y`, `import`, `promise`, `security`,
`@typescript-eslint/strict-type-checked`).

```
1. Check out `${BRANCH}` and run `npm run lint` to see the errors.
2. Fix each error — do NOT suppress rules with `eslint-disable` unless the
   suppression carries an inline justification comment AND the file's
   primary maintainer (CODEOWNERS) is explicitly tagged for review.
3. Prefer the safest auto-fix first: `npm run lint:fix`. Only hand-edit
   what `--fix` cannot resolve.
4. Run `npm run lint` and confirm 0 errors remain.
5. Run `npm run build:dev` and `npm test` to confirm nothing else broke.
6. Push to the SAME branch (`${BRANCH}`) — do not open a new branch when
   the issue points at an existing PR.
```

## Fragment: `fix-test-failure`

Use for CI workflow_run failures on `copilot/**` branches.

```
1. Open the failed run at `${RUN_URL}` and read the failed step log
   excerpted in the issue body.
2. Reproduce locally with the exact command shown (usually `npm test --
   --reporter=verbose ${TEST_FILE}` or `./android/gradlew ${GRADLE_TASK}`).
3. Determine whether the failure is (a) a regression in the change,
   (b) a flaky test, or (c) an environment / toolchain mismatch.
4. (a) → fix the regression. (b) → fix the flake at the root (timing,
   ordering, shared state) — do NOT add `.skip` or `retry`. (c) → align
   with `copilot-setup-steps.yml` toolchain.
5. Push to the SAME branch (`${BRANCH}`) — do not open a new branch.
6. Confirm the previously-failing job goes green on the new commit.
```

## Fragment: `fix-android-lint`

Use for Android Gradle lint dispatches (one-issue-per-rule by default).

```
1. Reproduce with:
     JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64 \
       ./android/gradlew lintPlayDebug --no-daemon
2. Open `android/app/build/reports/lint-results-playDebug.html` for the
   full report. Filter by rule id `${RULE_ID}` and file `${FILE}`.
3. Fix the rule violation in source. Do NOT add `tools:ignore` /
   `lint.xml` suppression unless the rule is genuinely a false positive
   for this codebase — if so, justify in the lint.xml comment.
4. Re-run lint; confirm `${RULE_ID}` is gone and no new rules surfaced.
5. Run `npm run build:dev`, `npx cap sync android`, and `npm test`.
6. Use branch name: `copilot/fix-android-lint-${RULE_SLUG}-${YYYY_MM_DD}`.
```

## Fragment: `dep-vuln-bump`

Use for OSV-Scanner / Trivy / npm audit / `secret_scanning_alert`
findings against a dependency.

```
1. Read the advisory at `${ADVISORY_URL}`. Confirm the affected version
   range covers what is currently resolved (`npm ls ${PACKAGE}` or
   `./android/gradlew ${MODULE}:dependencyInsight --dependency ${PACKAGE}`).
2. Bump the DIRECT dependency that pulls in the vulnerable transitive,
   not the transitive itself, unless the transitive is already pinned
   in `package.json` `overrides` — in which case TIGHTEN the existing
   pin (never weaken it).
3. After the bump, run `npm ci`, `npm run lint`, `npm run build:dev`,
   `npm test`, and `npx cap sync android`. For Android-only deps also
   run `./android/gradlew assemblePlayDebug`.
4. Verify with `npm audit --omit=dev` (or the original scanner) that
   the advisory is no longer reported.
5. Use branch name: `copilot/fix-dep-${PACKAGE}-${NEW_VERSION}`.
6. In `## Lessons learned`, note whether the upstream had a patch or
   the fix required a major bump (informs future Dependabot grouping).
```

## Fragment: `coverage-gap-fill`

Use for `coverage-dispatch.yml`.

```
1. Identify the file at `${FILE}` and read it together with any
   sibling `*.test.ts(x)`.
2. Aim to cover the uncovered line ranges listed below. Prefer
   exercising real behaviour over snapshotting; one focused test per
   behavioural branch beats one giant render-and-assert.
3. If the file is hard to test because it mixes presentation + logic
   (App.tsx, AppBuilder.tsx, LocalIDE.tsx are the known offenders),
   extract a small testable subcomponent / hook FIRST in this PR, then
   write tests against the extracted piece. Do NOT add e2e-style
   mocking shortcuts to a giant component to inflate coverage numbers.
4. Run `npm run test:coverage` and confirm:
   - the file's line coverage is now ≥ `${TARGET_PCT}%`
   - global thresholds in `vitest.config.ts` still pass
   - no new ESLint errors
5. Use branch name: `copilot/cov-${FILE_SLUG}`.
6. In `## Lessons learned`, note any production code change that was
   needed to make a branch testable (test-induced design pressure is
   useful future signal).
```

## Fragment: `fix-secret-leak`

Use for `secret_scanning_alert` dispatches.

```
⚠️ This issue indicates a credential is exposed. Treat as urgent.

1. **Rotate the secret FIRST** in the upstream provider (do not wait
   for the code fix to land). The secret in the repo must be assumed
   compromised the moment the alert fires.
2. After rotation, remove every occurrence from current files.
3. If the secret was committed, also rewrite history with
   `git filter-repo` — coordinate with the owner; this is one of the
   FEW cases where a force-push to main is permitted, and it MUST be
   announced.
4. Add a regression guard: a `pattern-scan.yml` rule for the secret
   pattern, OR a unit test asserting the loader rejects literals
   matching the pattern.
5. Use branch name: `copilot/fix-secret-${ALERT_NUMBER}`.
```

## Fragment: `fix-compatibility`

Use for `compatibility-matrix.yml` findings (browserslist regression,
Node-engines mismatch, peer-dep conflict, Android compatSdk fallout).

```
1. Read the specific finding category in the issue body
   (`browser` | `node-engines` | `peer-deps` | `android-back-compat`).
2. For browser regressions: identify the dependency that introduced
   the unsupported syntax; either bump it past the fix, downgrade,
   or add a Babel/SWC pass — do NOT silently widen browserslist.
3. For Node-engines: confirm `engines.node >= 24.0.0` is still
   satisfiable across all transitive deps. Pin or replace the
   offender.
4. For peer-dep conflicts: resolve via `package.json` `overrides`
   ONLY if a pin upgrade isn't viable, and document the override.
5. For Android back-compat: lower the API call to a supported method
   or guard with `Build.VERSION.SDK_INT >= ...`.
6. Re-run `compatibility-matrix.yml` (`workflow_dispatch`) and confirm
   the finding clears.
```

---

## Authoring rules

- Keep each fragment **≤ 60 lines**. Long instructions get skipped.
- Always include the branch-naming convention from
  `copilot-instructions.md` § *Auto-fix issue contract*.
- Never embed secrets, alert IDs, or run URLs as fixed values —
  reference them as `${VAR}` placeholders so the dispatcher
  substitutes them at issue-creation time.
- When you add a new fragment, also:
  1. add it to the `dispatch-fix-issue` composite action's
     `fragment` input enum;
  2. add a row to the table in `docs/AGENT_OPERATIONS.md`.
