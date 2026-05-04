# AGENTS.md

> Portable agent contract for **TrueAI LocalAI**. This file follows the
> [agents.md](https://agents.md) convention so any AI coding agent
> (GitHub Copilot, Claude Code, Codex CLI, Cursor, Aider, …) reads the
> same hard constraints without symlinking into `.github/`.
>
> **The canonical long form is
> [`.github/copilot-instructions.md`](.github/copilot-instructions.md)**.
> If the two ever disagree, the long form wins. This file is a digest.

## Project at a glance

- **TrueAI LocalAI** — a local-first AI assistant platform.
- Web app: **React + TypeScript + Vite + Tailwind + shadcn/ui**, framer-motion.
- Native mobile: **Capacitor 8** wrapping the web app for **Android** (`android/`).
- Local LLM runtime: `src/lib/llm-runtime/`. Native abstractions: `src/lib/native/`.
- License: **MIT** with mandatory attribution preservation — see
  [`NOTICE`](NOTICE) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Toolchain (must match exactly)

| Tool | Version | Why |
|---|---|---|
| Node.js | **24** | `package-lock.json` was generated with Node 24 / npm 11 and pins optional native binaries (`lightningcss-*`, `@rollup/rollup-*`, `fsevents`). Older Node fails `npm ci`. |
| npm | **11** (bundled with Node 24) | Same as above. |
| JDK | **Temurin 21** | Capacitor 8 / `capacitor-android` is compiled with `--release 21`. JDK 17 fails `compileDebugJavaWithJavac`. |

When invoking Gradle, set `JAVA_HOME` per command:

```bash
JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64 ./android/gradlew ...
```

## Build, lint, test

| Task | Command |
|---|---|
| Install deps | `npm ci` |
| Dev build (`__APP_DEBUG__=true`) | `npm run build:dev` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Type check (no emit) | `npm run typecheck` |
| Android debug APK | `npm run android:build` |
| Android release APK | `npm run android:build:release` |

## Hard constraints (NEVER violate these)

These mirror the protected-branch ruleset. PRs that violate them are
auto-rejected — the agent loses the round-trip even if the diff is
otherwise correct.

- ❌ Do not modify `LICENSE` or `NOTICE`.
- ❌ Do not strip in-source `Copyright (c) 2024-2026 Skyler Jones
  ("smackypants") / Advanced Technology Research` headers.
- ❌ Do not edit anything under `.github/**` unless the task explicitly
  asks for it.
- ❌ Do not weaken `package.json` `overrides` pins:
  `path-to-regexp ^8.4.0`, `postcss ^8.5.10`, `lodash ^4.17.24`,
  `brace-expansion@1 ^1.1.13`. For a dependency vulnerability, **tighten**
  the pin or upgrade the direct dependency — never remove a pin.
- ❌ Do not add telemetry, analytics, or third-party network calls.
  This project is local-first by design. Hosted LLM providers stay
  opt-in and dynamically imported (see
  `src/lib/llm-runtime/ai-sdk/provider-factory.ts`).
- ❌ Do not store credentials in `localStorage`. The LLM API key lives
  exclusively under `__llm_runtime_api_key__` via `secureStorage` /
  `kvStore.setSecure()`. There is a regression test in
  `src/lib/llm-runtime/kv-store.test.ts`; keep it passing.
- ❌ Do not disable or bypass CodeQL, Android CI, or any required
  status check.
- ❌ Do not `git push --force` against `main` (blocked by ruleset
  anyway).

## Conventions

- **State persistence**: app-wide UI state uses `useKV` from
  `@github/spark/hooks` (aliased to local shims in `vite.config.ts`).
  Validate stored values against a known set so renamed/removed options
  fall back cleanly — see the `isTabName` guard around
  `useKV<string>('active-tab', DEFAULT_TAB)` in `src/App.tsx`.
- **Native abstractions**: all native capabilities live in
  `src/lib/native/` (`platform`, `secure-storage`, `network`,
  `clipboard`, `share`, `haptics`, `app-lifecycle`, `notifications`,
  `filesystem`). Each module branches on `isNative()` and falls back to
  a web API. Import via `@/lib/native`.
- **Runtime config**: `runtime.config.json` MUST live in `public/` so
  Vite copies it into `dist/` and `cap sync` includes it in the APK.
- **LLM config layering** (low → high precedence): hard-coded defaults
  → `public/runtime.config.json` `llm` block → KV key
  `__llm_runtime_config__`.

## Definition of done for an agent PR

1. `npm ci` succeeds.
2. `npm run lint` exits 0 (no new errors).
3. `npm run build:dev` succeeds.
4. `npm test` passes — no newly failing tests.
5. CodeQL must not introduce new alerts.
6. CODEOWNERS reviewer (`@smackypants`) approves.
7. All review threads resolved.
8. Auto-merge (squash) takes it from there.

## Minimal-change principle

Fix only what the task describes. Do not refactor unrelated code,
rename variables, or reformat files outside the changed lines. The
smaller the diff, the faster the review and the lower the regression
risk.

## Where to look next

- Long-form Copilot instructions:
  [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
- Auto-curated lessons learned (read before any non-trivial task):
  [`.github/copilot/LEARNINGS.md`](.github/copilot/LEARNINGS.md)
- Canonical prompt fragments embedded by dispatchers:
  [`.github/copilot/PROMPTS.md`](.github/copilot/PROMPTS.md)
- Operator runbook:
  [`docs/AGENT_OPERATIONS.md`](docs/AGENT_OPERATIONS.md)
- Runtime / token / environment reference:
  [`AGENT_RUNTIME.md`](AGENT_RUNTIME.md) and
  [`.github/copilot/AGENT_RUNTIME.md`](.github/copilot/AGENT_RUNTIME.md)
- Repo-wide upgrade tracker:
  [`trueai_upgrade_plan.md`](trueai_upgrade_plan.md)

## Sub-agents

Per-task agent prompts live under
[`.github/agents/`](.github/agents/). Each `*.agent.md` declares a
named teammate (e.g. `bug-fix-teammate`) with its own scope. Agent CLIs
that support per-task profiles should respect the front-matter `name`
field.

## Recommended model

This repo's recommended coding-agent model is **`claude-opus-4.7`**.
Acceptable fallbacks (priority order): `claude-opus-4.5`,
`claude-sonnet-4.6`, `gpt-5.4`, `gpt-5.5`, `gpt-5.3-codex`,
`gemini-2.5-pro`. See
[`.github/copilot/AGENT_RUNTIME.md`](.github/copilot/AGENT_RUNTIME.md)
for the rationale and owner-only toggles (runner size, firewall,
environments).
