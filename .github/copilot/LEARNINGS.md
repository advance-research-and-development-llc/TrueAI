# Project learnings — auto-curated agent memory

> **Read this file at the start of every non-trivial task.**
>
> This is the canonical, append-only knowledge log for the TrueAI
> LocalAI repo. New entries are added automatically by
> `.github/workflows/learnings-ingest.yml` when a PR is merged into
> `main`, by parsing the `## Lessons learned` section of the PR
> body. Manual edits are allowed but discouraged — prefer adding the
> lesson to your PR body so it's tied to a specific change.
>
> **Format:** newest entries first. Each entry has a date, a short
> title, the PR / commit it came from, and one to three bullet
> points. An entry tagged `SUPERSEDES:` replaces an older entry of
> the same title.

---

## 2026-04-29 — PR #102: test: cover ThemeSwitcher settings component

_Source: [https://github.com/smackypants/trueai-localai/pull/102](https://github.com/smackypants/trueai-localai/pull/102) · merged f213a0c10df1 · author @Copilot_

- Stateful `useKV` mock via `React.useState` is significantly simpler than the `vi.fn(() => [def, vi.fn()])` pattern when a test needs to drive multi-step UI state.
- A Proxy-based `framer-motion` passthrough + Fragment `AnimatePresence` is a reusable recipe for testing animation-heavy components in jsdom.

---

## 2026-04-29 — PR #76: feat: expand automated bug scanning — fix agent dispatch, add TS check, lint issue dispatch, build CI watch

_Source: [https://github.com/smackypants/trueai-localai/pull/76](https://github.com/smackypants/trueai-localai/pull/76) · merged 9240c2ae13c3 · author @Copilot_

- `github/copilot-swe-agent@v1` is GitHub-internal infrastructure — it is **not** a user-callable action. The Copilot coding agent is triggered by assigning issues to `@copilot`; `copilot-setup-steps.yml` provisions its environment. A `workflow_dispatch` issue-dispatch workflow is the correct pattern for "run the agent on demand".
- When adding a row to a bash heredoc markdown table, embed the value as a shell variable (`${TS_LABEL}`) inside a fixed-width table row string rather than constructing the entire row as a variable — keeps indentation consistent with the surrounding heredoc.
- `workflow_run: workflows: [...]` accepts a list; adding a second workflow name is a one-line expansion that costs nothing in extra complexity.

---

## 2026-04-29 — PR #69: feat: automated bug scanning and Copilot agent auto-fix pipeline (Phases 2–8)

_Source: [https://github.com/smackypants/trueai-localai/pull/69](https://github.com/smackypants/trueai-localai/pull/69) · merged 90ef45960fa8 · author @Copilot_

- The `code_scanning_alert` event never fires if Code Scanning is not enabled in repo settings — the `continue-on-error: true` workaround in `codeql.yml` is load-bearing until the owner completes the UI step.
- `pull_request_target` workflows inherit the permissions of the base branch, which is why `dependabot-auto-merge.yml` uses that trigger — the new `issues: write` permission was added to the existing `permissions` block rather than introducing a new job.
- For `workflow_run` triggers, the `branches` filter matches the HEAD branch of the triggering workflow run (not a base branch), making it suitable for filtering `copilot/**` branches cleanly.

---

## 2026-04-29 — PR #68: test(native): cover install.ts and refresh TEST_COVERAGE_SUMMARY (Phase 0+1)

_Source: [https://github.com/smackypants/trueai-localai/pull/68](https://github.com/smackypants/trueai-localai/pull/68) · merged 14c43821ea9d · author @Copilot_

- `src/lib/native/install.ts` self-installs at import. Tests must use top-level `vi.mock` + `vi.hoisted` for per-test mocks, plus per-test `vi.resetModules()` + dynamic `import()` to reset the `installed` flag. Async side effects gated by `setTimeout` (e.g. `SplashScreen.hide`) require `vi.waitFor(...)` since explicit calls return immediately due to the guard.

---

## 2026-04-28 — PR #61: test: add mobile component tests + fix swipeable-card opacity bug

_Source: [https://github.com/smackypants/trueai-localai/pull/61](https://github.com/smackypants/trueai-localai/pull/61) · merged f003eabd3736 · author @Copilot_

- `framer-motion` `AnimatePresence` defers DOM removal until exit animations complete. In jsdom there is no animation engine, so elements stay in the DOM after `setShow(false)`. Don't assert element absence after state-driven exit; instead verify side effects (`skipWaiting` called, `reload` called).
- `window.location.reload` is not configurable in jsdom. Use `vi.stubGlobal('location', { reload: vi.fn() })` and clean up with `vi.unstubAllGlobals()`.
- `useThrottle` initialises `lastRun = Date.now()` at mount time. With `vi.useFakeTimers()` no real time elapses between `renderHook` and the first invocation, so the throttle blocks the call. Always `vi.advanceTimersByTime(delay + 1)` before the first call in fake-timer throttle tests.

---

## 2026-04-28 — PR #62: feat: mobile debug logger with structured event capture and bug-pattern analysis

_Source: [https://github.com/smackypants/trueai-localai/pull/62](https://github.com/smackypants/trueai-localai/pull/62) · merged 1c4a7020752b · author @Copilot_

- `installMobileDebugLogger()` mirrors the `installPreMountErrorCapture()` pattern: synchronous, returns cleanup, guarded by `_installed` flag, safe against SSR/no-window environments.
- `PerformanceObserver` with `{ type: 'navigation', buffered: true }` captures slow loads that have already fired before the observer was registered — no need to hook `window.addEventListener('load')` separately.
- Storing only non-`undefined` data fields via `...(data !== undefined ? { data } : {})` keeps entries compact; JSON serialisation silently drops `undefined` values inside objects anyway.

---

## 2026-04-28 — PR #60: test: add visual/content component test coverage — chat, VirtualList, AnimatedCard, EnhancedLoader (+ accessibility fixes)

_Source: [https://github.com/smackypants/trueai-localai/pull/60](https://github.com/smackypants/trueai-localai/pull/60) · merged d66b265e0f26 · author @Copilot_

- **Radix UI portals**: Dialog/Select/Popover content renders outside the `container` returned by `render()`. Always use `document.body.querySelector()` or Testing Library's `screen.*` helpers (which search the whole document) when asserting on portal content — `container.querySelector()` will return null.
- **Icon-only button accessibility**: Radix `TooltipContent` provides `aria-describedby` (not `aria-labelledby`) on the trigger, so icon-only buttons wrapped in Tooltip have an empty accessible name unless `aria-label` is added explicitly. Add `aria-label` to all icon-only buttons — it fixes both the accessibility gap and enables `getByRole('button', { name: /.../ })` in tests.
- **Radix Select options in tests**: `SelectItem` options are not in the DOM until the trigger is clicked; portal content may still be inaccessible via `role="option"` in jsdom. Test the selected item's display text via `SelectValue` in the trigger instead of querying the open dropdown.

---

## 2026-04-28 — PR #59: test: add comprehensive coverage for diagnostics, benchmark, serviceWorker, preloader, and pre-mount error capture

_Source: [https://github.com/smackypants/trueai-localai/pull/59](https://github.com/smackypants/trueai-localai/pull/59) · merged cc08560b489b · author @Copilot_

- When testing `preMountErrorCapture` renderFallback via event dispatch, `vi.doMock('./diagnostics', factory)` inside `it()` bodies does NOT reliably intercept the module when `preMountErrorCapture` is freshly imported with `vi.resetModules()` — the mock hangs/times out. The correct pattern is a **separate test file** with `vi.mock('./diagnostics', factory)` at the top level (gets hoisted), combined with per-test `vi.resetModules()` + dynamic `await import('./preMountErrorCapture')` to reset module-level flags (`installed`, `reactMounted`, `fallbackShown`).
- When testing `PromiseRejectionEvent`, always call `.catch(() => {})` on the rejected promise passed to the constructor — otherwise the test environment emits a spurious "Unhandled error" even though the test itself passes.

---

## 2026-04-28 — PR #57: test: add coverage for use-performance-optimization and llm-runtime/install

_Source: [https://github.com/smackypants/trueai-localai/pull/57](https://github.com/smackypants/trueai-localai/pull/57) · merged eeee71dbae31 · author @Copilot_

- When testing hooks that register `navigator.connection` event listeners, always call `unmount()` before tearing down the navigator stub — cleanup effects re-read the property and will throw if it's already gone.

---

## 2026-04-28 — PR #56: fix(ci): update release.yml to auto-attach APKs to latest release

_Source: [https://github.com/smackypants/trueai-localai/pull/56](https://github.com/smackypants/trueai-localai/pull/56) · merged 37d13754d055 · author @Copilot_

- `release.yml`'s `workflow_dispatch` trigger did not specify `ref:` in the `actions/checkout` step, so manual runs checked out `HEAD` instead of the intended tag. Always resolve the target tag explicitly before checkout when a workflow can be triggered by multiple event types.
- The `release: [published]` event is a reliable safety-net trigger for attaching release artifacts; the `push: tags: v*` event can be silently skipped when the tag is pushed by another workflow (e.g. `release-bump.yml`) rather than by a direct git push.
- For `workflow_dispatch` inputs that have a natural default (e.g., "latest release"), marking them `required: false` with auto-detection via `gh release view` improves usability significantly.

---

## 2026-04-28 — PR #55: test: add coverage for serviceWorker and preMountErrorCapture (0% → meaningful coverage)

_Source: [https://github.com/smackypants/trueai-localai/pull/55](https://github.com/smackypants/trueai-localai/pull/55) · merged 15cee64fa912 · author @Copilot_

- jsdom 29 partially implements `navigator.serviceWorker` — `'serviceWorker' in navigator` is always `true`, but methods like `getRegistrations()` may hang; always stub with a full mock including `getRegistrations: vi.fn().mockResolvedValue([])` when testing SW-adjacent code
- Module-level state in error-capture modules survives `vi.resetModules()` window listeners — avoid dispatching global `ErrorEvent` / `PromiseRejectionEvent` across module-isolation boundaries; test DOM quiescence via timer advancement instead

---

## 2026-04-28 — PR #52: fix: resolve all lint warnings and lockfile sync issue

_Source: [https://github.com/smackypants/trueai-localai/pull/52](https://github.com/smackypants/trueai-localai/pull/52) · merged c680591b2dd0 · author @Copilot_

- When Capacitor plugin modules are lazily imported via `try/catch` dynamic imports, type the holding variable with `import type { Plugin } from '@capacitor/plugin'` + `| null` instead of `any`. For enum-valued variables (e.g. `Style`, `KeyboardResize`), use `typeof import('@capacitor/status-bar').Style | null` — this gives full enum-member access (`Style.Dark`) without losing type safety.
- A stale `packages/spark-tools` entry with `"extraneous": true` in `package-lock.json` is a pre-existing artefact from when a workspace package was removed; `npm install --package-lock-only` preserves it and `npm ci` ignores it safely.

---
