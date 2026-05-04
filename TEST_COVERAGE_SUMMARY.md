# Test Coverage Summary

> **Status:** living document, refreshed alongside PRs that add tests.
> Numbers below come from `npm run test:coverage` (vitest + v8).

## Current snapshot

_As of 2026-05-04 (post B.2 follow-up — `client.ts` branches → 100%)._

| Metric | Value | Δ vs. prior snapshot |
|---|---|---|
| Test files | **209** | +0 |
| Tests | **2910** | +1 |
| Global lines | **84.31%** | (no change — single non-line branch) |
| Global branches | **74.68%** | (held; touched module already 100% lines) |
| Global functions | **74.79%** | (held) |
| Global statements | **81.97%** | (held) |

This sweep landed:

- `src/lib/llm-runtime/client.test.ts` — **+1 test** covering the
  `text || '(empty body)'` arm in the non-OK response branch on
  `client.ts:175`. This is the path Cloudflare-style empty 5xx
  gateway responses take, and the user-facing message must still
  be useful when the upstream returns no body text. Took
  `client.ts` branches from **98.75% → 100%** while lines stayed
  at the existing 100%. Lines/functions/statements unchanged
  (single-branch surgical add); thresholds in `vitest.config.ts`
  unchanged.

## Earlier snapshot (post sidebar primitive coverage)

_As of 2026-05-04 (post sidebar primitive coverage, on top of Phase 2.9)._

| Metric | Value | Δ vs. Phase 2.9 snapshot |
|---|---|---|
| Test files | **209** | +2 |
| Tests | **2909** | +57 |
| Global lines | **84.31%** | +0.87 pp |
| Global branches | **74.68%** | +1.16 pp |
| Global functions | **74.79%** | +0.96 pp |
| Global statements | **81.97%** | +0.85 pp |

This sweep landed:

- `src/components/ui/sidebar.test.tsx` — **+27 tests** taking
  `src/components/ui/sidebar.tsx` (the only remaining ≥30 LOC file at
  0% coverage) from **0 / 0 / 0 / 0** to **100 / 100 / 100 / 97.26**
  (lines / functions / statements / branches). Unlike the thin
  Radix wrappers exercised in `shadcn-primitives.test.tsx`, sidebar
  ships substantial app logic — controlled and uncontrolled provider
  state, cookie persistence, the Ctrl+B / Meta+B keyboard shortcut
  (with its `preventDefault` and per-key gating), the
  `useSidebar` context guard, the mobile-Sheet portal branch versus
  the desktop variant matrix (`side` × `variant` × `collapsible`),
  the `SidebarTrigger`/`SidebarRail` toggle paths, and every
  `asChild` / `tooltip` / `showOnHover` / `size` permutation across
  `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuSubButton`,
  `SidebarGroupLabel`, `SidebarGroupAction`, and `SidebarMenuSkeleton`
  (with `Math.random` stubbed for the inline `--skeleton-width`
  CSS-var assertion).

After this sweep the largest remaining uncovered surface is the
explicitly deferred App / Builder shell (`AppBuilder.tsx`,
`LocalIDE.tsx`, the heavy event handlers in `App.tsx`/`App-Enhanced.tsx`)
— see Phase 4 in the roadmap. `vitest.config.ts` thresholds are
unchanged from the Phase 2.9 ratchet (lines 83 / fns 73 / branches 73 /
stmts 81) and continue to pass with margin.

## Earlier snapshot (post Phase 2.9 — leaf-hook branch density)

_As of 2026-05-04 (post Phase 2.9 — leaf-hook branch density)._

| Metric | Value | Δ vs. prior snapshot |
|---|---|---|
| Test files | **207** | +0 |
| Tests | **2852** | +19 |
| Global lines | **83.44%** | +0.07 pp |
| Global branches | **73.52%** | +0.25 pp |
| Global functions | **73.83%** | +0.11 pp |
| Global statements | **81.12%** | +0.12 pp |

This sweep landed targeted **branch-density** uplift on two leaf hooks
both of which had a large `lines% − branches%` gap that suggested cheap
edge-case coverage wins:

- **`src/hooks/use-streaming-chat.ts`** — L 94.83% → **96.55%**, B
  **68.18% → 86.36%** (+18 pp), F → **100%**. Five new tests in
  `src/hooks/use-streaming-chat.test.ts`:
  1. `system` prompt prepended to messages (and skipped when empty).
  2. Mid-stream `error` parts surfaced via the `streamText({ onError })`
     callback → `streamError` → for-await `throw`.
  3. Non-Error `onError` payload (a bare string) wrapped into an Error
     before rethrowing.
  4. Non-Error thrown by `model.doStream` wrapped in the catch block's
     `err instanceof Error ? err : new Error(String(err))` fallback.
  5. `abort()` during an in-flight `send()` against a never-ending
     ReadableStream that calls `controller.error(new DOMException(...))`
     on the AbortSignal — exercises the `userAbortedRef`
     for-await-break and catch-block branches deterministically.
- **`src/hooks/use-contextual-ui.ts`** — L 94.39% → **100%**, B 67.74% →
  **100%** (+32 pp), F → **100%**. 12 new tests:
  - **Time-of-day branches:** parametrized `it.each` over four pinned
    `vi.setSystemTime` values to exercise every branch of the
    `morning / afternoon / evening / night` if-else ladder in both
    `trackTimeOfDay` and `generateSuggestions`.
  - **Null-behavior fallback:** a dedicated `describe` block overrides
    the `useKV` mock to return `null` (the real "not yet hydrated from
    IndexedDB" state). Covers every `prev ?? initialBehavior` fallback
    in `trackFeatureUsage` / `trackTimeOfDay` / `trackError` /
    `trackSessionDuration`, the `prev || []` fallback in
    `dismissSuggestion`, and the `if (!behavior)` early returns in
    `generateSuggestions` / `getPredictedNextAction` /
    `getRecommendedFeatures`.

The `useKV` mock was upgraded from a static `useState(initial)` impl to a
mutable `useKVImpl` reference so individual tests can opt into returning
`null` without owning a separate test file. The default impl is restored
in `afterEach`. This is a reusable pattern for any hook test that needs
to exercise the "value not yet hydrated" branch.

`vitest.config.ts` thresholds were ratcheted: statements **80 → 81**
(baseline 81.12%); branches **73 → 73** (baseline now 73.52%, was
73.27%); lines and functions unchanged at 83 / 73.

`npm test` and `npm run test:coverage` both pass cleanly _on the new
tests_; two unrelated pre-existing failures in
`src/lib/llm-runtime/config.test.ts` (the validator does not floor
fractional `topK` or revert out-of-range `minP` / `repeatPenalty` to
defaults) remain on `main` and are out of scope for this slice — they
should be addressed by a Phase 3 single-defect PR.

## Earlier snapshot (pre-Phase 2.9)

_As of 2026-05-03 (post Phase 2.8 — `App.tsx` shell uplift)._

| Metric | Value | Δ vs. prior snapshot |
|---|---|---|
| Test files | **207** | +18 |
| Tests | **2833** | +743 |
| Global lines | **83.37%** | +17.6 pp |
| Global branches | **73.27%** | +18.7 pp |
| Global functions | **73.72%** | +19.6 pp |
| Global statements | **81.00%** | +17.4 pp |

That sweep landed:

- `src/App.routing.test.tsx` — **+12 tests** covering `App.tsx` seams the
  existing smoke test (`src/App.test.tsx`) deliberately avoided due to
  jsdom heap pressure. Per-file `App.tsx` coverage went from
  **21.5 / 14.8 / 5.3 / 26.6** (stmt / br / fn / lines) to
  **29.9 / 22.9 / 18.0 / 34.5** by carving testable seams without
  modifying production code: `isTabName` guard (valid / invalid /
  wrong-type persisted active-tab), top-level `handleTabChange`
  routing across all six tabs, tab-trigger hover handlers, header
  icon-button dialog open paths (Settings, Customize), the
  `createConversation` create + cancel flows, the `useIsMobile=true`
  shell (MobileBottomNav + chat-tab FloatingActionButton conditional),
  and the agents-tab sub-tab walk plus the `createAgent` dialog flow
  including `toggleAgentTool`.

The remaining `App.tsx` gaps are the heavy event handlers (`runAgent`
160 LOC, `executeWorkflow` 101 LOC, `sendMessage` 90 LOC,
`triggerLearning` 76 LOC). Those require either (a) un-mocking lazy
panels — heap-prohibitive per the existing test author's note — or
(b) intricate per-test seeding of `useKV` state. Both are deferred to
post-decomposition slices, consistent with the roadmap's Phase 4
caveat for the App / AppBuilder / LocalIDE monoliths.

`vitest.config.ts` thresholds were ratcheted up from the post-Phase-10
floors (lines 82 / fns 72 / branches 72 / stmts 79) to the new
rounded-down baseline (lines 83 / fns 73 / branches 73 / stmts 80).

`npm test` and `npm run test:coverage` both pass cleanly. Coverage
reports are written to `coverage/` (`text`, `json`, `html`, `lcov`).

## Earlier snapshot (pre-Phase 2.8)

_As of 2026-04-29 (post Phase A–E coverage push)._

| Metric | Value | Δ vs. Phase 2 |
|---|---|---|
| Test files | **189** | +66 |
| Tests | **2090** | +613 |
| Global lines | **65.8%** | n/a (first measurement) |
| Global branches | **54.6%** | |
| Global functions | **54.1%** | |
| Global statements | **63.6%** | |

That earlier sweep landed:

- `src/main.tsx` — bootstrap test (`createRoot.render`, service-worker
  registration handlers, APK update check gating on Capacitor presence,
  pre-mount error capture install).
- `src/App-Enhanced.tsx` — smoke tests covering header, six tab triggers,
  empty conversation state. (App-Enhanced is currently only listed in
  `tsconfig.json`; the smoke test prevents type/render regressions until
  it's wired back into a build target.)
- `src/components/ui/dynamic-ui-customizer.tsx` and
  `dynamic-ui-dashboard.tsx` — both at 0% before; now exercised across
  preset application, switch toggles, tab navigation, empty/active states.
- `src/lib/llm-runtime/kv-store.ts` — IDB success/error/abort branches,
  subscribe / notify / unsubscribe, getOrSet, peek, keys, listener-error
  isolation. **53.9% → 81.0% lines.**
- `src/components/chat/MessageBubble.tsx` — hover / touch state branches,
  user vs. assistant avatar variants, multi-line content.
- `src/components/chat/ChatExportDialog.tsx` — JSON / Markdown / HTML
  format Blob branches via the Radix Select (with the
  `hasPointerCapture` / `scrollIntoView` jsdom stubs), metadata and
  timestamp toggles, missing-`systemPrompt` branch.
- `src/lib/native/network.ts` — listener-error isolation, unsubscribe
  semantics, cached `getNetworkStatusSync` post-init.

That sweep also lowered `vitest.config.ts` thresholds from the
aspirational 80/80/75/80 (which silently failed on `main` for several
PRs) to 65/53/53/63 — a level that **locked in then-current gains
without blocking non-coverage PRs**. Phases 1–10 + 2.1–2.7 + 2.8
ratcheted those floors back up to today's 83/73/73/80.

## Pre-Phase A snapshot

_As of 2026-04-29 (post Phase 2 — root `ErrorFallback.tsx` + `ThemeSwitcher`)._

| Metric | Value | Δ vs. Phase 1 |
|---|---|---|
| Test files | **123** | +11 |
| Tests | **1477** | +154 |

`src/ErrorFallback.tsx` went from **0% → ~100% lines** in this slice.
The new `src/ErrorFallback.test.tsx` exercises the DEV-mode rethrow,
the placeholder/loaded states, every action button (Try Again, Reload,
Copy, Share, Download, Report on GitHub), the conditional Share /
GitHub buttons, and all three branches of the automatic background
submission (`submitted`, `network-error`, silent reasons such as
`disabled` / `duplicate`).

`src/components/settings/ThemeSwitcher.tsx` (847 lines) went from **0%**
to broad coverage via the new `ThemeSwitcher.test.tsx` (16 tests). It
covers default-theme rendering, activate / preview / exit-preview, the
Create dialog (validation, success, cancel, base-theme selection),
delete (default-theme guard + custom-theme removal + active-id clear),
export (Blob download), Copy CSS (success + failure via `copyText`),
import file-picker invocation, and the editor save / cancel paths.

`npm test` and `npm run test:coverage` both pass cleanly. Coverage reports
are written to `coverage/` (`text`, `json`, `html`, `lcov`).

## Testing infrastructure

- **Runner:** Vitest 4 (`npm test`, `npm run test:ui`, `npm run test:coverage`)
- **Environment:** jsdom 29 (`vitest.config.ts`)
- **Libraries:** `@testing-library/react`, `@testing-library/user-event`,
  `@testing-library/jest-dom`, `fake-indexeddb`, `happy-dom`
- **Coverage provider:** `@vitest/coverage-v8`
- **Global setup:** [`src/test/setup.ts`](src/test/setup.ts) mocks
  `matchMedia`, `IntersectionObserver`, `ResizeObserver`, and the global
  `spark` shim. **`indexedDB` is intentionally NOT mocked** — see the
  comment block in `setup.ts` for the rationale; tests that need IDB
  install their own.

## Conventions enforced across tests

These are codified in [`.github/copilot/LEARNINGS.md`](.github/copilot/LEARNINGS.md)
and as agent memories. New tests must follow them:

- Query DOM via stable `data-slot` attributes (button, switch, checkbox,
  card, skeleton, progress, …) instead of Tailwind class selectors.
- Add `aria-label` to icon-only `<Button>` triggers; query with
  `getByRole('button', { name: /…/ })`. Radix `Tooltip` adds
  `aria-describedby`, **not** an accessible name.
- Radix `Dialog` / `Select` / `Popover` / `DropdownMenu` content renders
  in a portal — query via `screen.*` or `document.body.querySelector`.
- With `vi.useFakeTimers()`, **do not** pass `advanceTimers:` to
  `userEvent.setup()`. Advance manually with
  `await act(async () => { vi.advanceTimersByTime(ms) })` and use
  `fireEvent.click()` afterwards.
- For `vi.mock` factories that need module-level vars, use `vi.hoisted()`.
- When stubbing `URL.createObjectURL`, `navigator.serviceWorker`, or
  `window.location`, capture the original property descriptor and restore
  it in `afterEach` / `finally`.
- `framer-motion`'s `AnimatePresence` defers DOM removal until exit
  animations finish. In jsdom, assert side effects (e.g. `reload` was
  called) instead of element absence after `setShow(false)`.
- Modules with module-level state and `installed` guards
  (`preMountErrorCapture`, `mobile-debug-logger`, `native/install`) are
  tested via top-level `vi.mock` + per-test `vi.resetModules()` + dynamic
  `import()`. `vi.doMock` inside `it()` bodies is unreliable for these.

## Coverage by area (top level)

Numbers below are line coverage (`% Lines`) from the latest
`npm run test:coverage` run.

| Area | Lines | Notes |
|---|---|---|
| `src/lib` | **86.1%** | Business logic — strongest coverage area. |
| `src/lib/llm-runtime` | 74.5% | `kv-store.ts` has fallback paths still uncovered. |
| `src/lib/native` | **67.4%** *(post Phase 1)* | `install.ts` newly covered (was 0% → 91.1%). |
| `src/hooks` | **91.5%** | Strongest per-area coverage. |
| `src/components/chat` | 72.0% | Some message-bubble + export-dialog branches still uncovered. |
| `src/components/cost` | 80.9% | |
| `src/components/notifications` | 41.9% | `NotificationCenter`, `OfflineQueuePanel`, `CacheManager`, `PerformanceIndicator` untested. |
| `src/components/settings` | 15.0% | Most settings panels untested; `ThemeSwitcher.tsx` newly covered (was 0%). |
| `src/components/agent` | low | Only `AgentCard`, `AgentQuickActions`, `AgentStepView` covered. |
| `src/components/analytics` | mid | Charts covered; dashboards / panels untested. |
| `src/components/models` | 6.7% | Most model panels untested. |
| `src/components/builder` | 0% | Largest untested area; needs decomposition before unit tests. |
| `src/components/cache` | 0% | |
| `src/components/harness` | 0% | |
| `src/components/workflow` | 0% | High-risk per LEARNINGS PR #58. |
| `src/components/ui` | 22.8% | shadcn primitives — only the value-add wrappers warrant tests. |
| `src/App.tsx` / `App-Enhanced.tsx` / `main.tsx` / root `ErrorFallback.tsx` | 0% | App shell — Phase 2 target. |

## Phased roadmap (in progress)

| Phase | Scope | Status |
|---|---|---|
| 0 | Capture baseline coverage | ✅ done |
| 1 | Cover the last `src/lib/**` gap (`native/install.ts`) | ✅ done |
| 2 | App shell — `App.tsx`, `App-Enhanced.tsx`, `main.tsx`, root `ErrorFallback.tsx` | ✅ done (`App-Enhanced` smoke + `main` bootstrap added in Phase A) |
| 3.1 | Workflow components | ✅ done |
| 3.2 | Agent components (11) | ✅ done |
| 3.3 | Analytics components (7) | ✅ done |
| 3.4 | Models components (10) | ✅ done |
| 3.5 | Settings components (7) | ✅ done |
| 3.6 | Notifications components (4) | ✅ done |
| 3.7 | Cache, Harness, root-level Performance / Prefetch | ✅ done |
| 4 | Builder — smoke tests + decomposition tracking issue | 🟡 smoke tests landed; decomposition still pending |
| 5 | Selective UI primitives (value-add wrappers only) | ✅ done (`dynamic-ui-customizer`, `dynamic-ui-dashboard`) |
| 6 | Coverage thresholds in `vitest.config.ts` | ✅ done (pragmatic floors; raise after Phase 4 decomposition) |

Each phase is intentionally one PR-sized batch — matches the merge cadence
of PRs #59 – #66 in `.github/copilot/LEARNINGS.md`.

## Out of scope (deliberately not tested)

- Pure type files: `src/lib/types.ts`, `lib/workflow-types.ts`,
  `lib/app-builder-types.ts`, `vite-end.d.ts`, `*-variants.ts`.
- Re-export barrels: `src/components/ui/index.ts`, `src/lib/native/index.ts`.
- Vendored shadcn primitives that are pure prop-forwarding wrappers around
  Radix (e.g. `accordion`, `aspect-ratio`, `collapsible`, `hover-card`,
  `popover`, `separator`, `scroll-area`, `tooltip`, `sheet`, `drawer`,
  `menubar`, `navigation-menu`, `context-menu`, `breadcrumb`,
  `pagination`, `sonner`). These are upstream-tested.

## Running tests

```bash
# All tests (watch by default)
npm test

# One-shot run
npx vitest run

# With coverage report
npm run test:coverage

# Web UI
npm run test:ui

# Targeted file
npx vitest run src/lib/native/install.test.ts
```
