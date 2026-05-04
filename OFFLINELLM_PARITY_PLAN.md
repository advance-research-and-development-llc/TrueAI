<!--
  Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
  Advanced Technology Research. Licensed under MIT.
-->

# TrueAI vs. OfflineLLM — Parity Implementation Plan (canonical tracker)

This document is the single source of truth for the OfflineLLM-parity work
series. It supersedes the ad-hoc `PR N` markers that accumulated in test
descriptions and source comments while PR #3 and PR #9 were in flight, and
which had drifted into two overlapping numbering schemes.

If you are an agent (or human) about to open a PR in this series:

1. Find your PR's row in the **Master PR table** below.
2. Use that PR number — and only that PR number — in commit messages, PR
   titles, code comments, and `describe()` strings.
3. If your PR splits into multiple sub-PRs, use the suffix convention
   (`PR 4.a`, `PR 4.b`, …) and add a row under **Numbering History**
   recording the split.

---

## 0. Status snapshot

| # | PR    | Status   | Description |
|---|-------|----------|-------------|
| **PR 1** | #3 | ✅ merged | Local-wasm AI-SDK provider via `@wllama/wllama` (`src/lib/llm-runtime/ai-sdk/local-wllama-provider.ts`) + extended sampling knobs (Top-K / Min-P / Repeat Penalty / Context Size) + per-conversation overrides + Settings UI panels + download-progress pub-sub |
| **PR 2** | #9 | ✅ merged | In-tree Capacitor `Llama` plugin skeleton (`android/capacitor-llama/`, `src/lib/native/llama.ts`) — load / unload / isLoaded / one-shot complete, `arm64-v8a` only, dormant (no JS callsite invokes it yet) |
| **PR 3** | this branch | ✅ landed | Numbering reconciliation + this tracker doc |
| **PR 4.a** | this branch | 🚧 in flight | Native streaming JNI surface + `local-native` AI-SDK provider + ABI matrix expansion (`armeabi-v7a`, `x86_64`) + `local-wasm` auto-fallback |
| **PR 4.b** | _follow-up_ | ⏳ deferred | Small LRU of loaded models (relax the bridge's single-model invariant) |
| **PR 5** | this branch | 🚧 in flight | In-app GGUF importer + on-disk model registry: pure-TS GGUF parser, native SAF picker (`android/capacitor-file-picker/`), web `<input type=file>` fallback, app-private storage (`Filesystem.Directory.Data/models/<sha>.gguf` on native, Cache Storage on web), free-space guard, idempotent SHA-256 dedupe; `local-wllama` accepts `cache://` and `file://` model sources; `local-native` error message points at the new UI. No schema migration — the existing `gguf-models` KV key is reused and legacy entries lacking `path`/`metadata` are pruned at first read. |

---

## 1. Master PR table (canonical, post-renumber)

Each row is a single tracked PR. Items grouped under a single PR number can
be split if they get too large; the doc remains the source of truth and gets
updated in the same PR that splits.

| #     | Theme                                     | One-line scope |
|-------|-------------------------------------------|----------------|
| **PR 1 ✅** | Local-wasm runtime foundation            | wllama AI-SDK provider + sampling knobs + per-conversation overrides + Settings UI + download progress |
| **PR 2 ✅** | Native plugin skeleton (Android)         | `android/capacitor-llama/` JNI plugin: load / one-shot complete, `arm64-v8a`, dormant |
| **PR 3**    | Numbering reconciliation + tracker doc   | This phase |
| **PR 4**    | Native streaming + `local-native` AI-SDK provider | Streaming JNI surface, AI-SDK `LanguageModelV1` provider, ABI matrix expansion (`armeabi-v7a`, `x86_64`), small LRU of loaded models, web/iOS automatic fallback to `local-wasm` |
| **PR 5**    | GGUF model importer + manager            | Local GGUF file picker (Capacitor `Filesystem`), validation, metadata extraction, persistent registry, deletion, free-space guard |
| **PR 6**    | Hugging Face / model-hub browser hardening | `HuggingFaceModelBrowser` upgraded with quantization filter, file-size estimate, parallel-chunk download, resume-on-failure, checksum verification |
| **PR 7**    | Sampling presets + grammar / JSON-mode   | OfflineLLM-style preset chips (`Creative`, `Balanced`, `Precise`, `Code`), GBNF grammar field, JSON-mode toggle, structured-output schema input |
| **PR 8**    | Per-model defaults + auto-tune           | Detect model family (Llama/Qwen/Mistral/Phi/Gemma) from GGUF metadata; per-family chat templates and sampling defaults; "auto-tune" picks `nThreads`/`nGpuLayers` from device probe |
| **PR 9**    | Hardware probe + GPU offload             | Android Vulkan/OpenCL/CPU backend selection, `n_gpu_layers` UI, NEON/dotprod CPU feature detection, Web `navigator.gpu` (WebGPU) probe behind a flag |
| **PR 10**   | Background-thread inference + cancellation | Move JNI `complete`/`stream` off main thread to a `HandlerThread`/coroutine; first-class cancel token JS → JNI; cancel button in chat UI |
| **PR 11**   | Persistent KV-cache + prompt caching     | Save `llama_state_save_file` between turns per conversation; warm restart; eviction policy; toggle in Settings |
| **PR 12**   | Multi-conversation, branching, regen     | Tree-shaped chat (à la OfflineLLM/ChatGPT), regenerate from any node, branch labels, export/import per branch |
| **PR 13**   | RAG over local docs                      | Local embeddings (BGE-small/all-MiniLM via wllama); on-device vector store (sqlite-vec / IndexedDB); doc ingestion (PDF/MD/TXT/DOCX); citations in chat |
| **PR 14**   | Tool / function calling for local models | Wire `ToolLoopAgent` to `local-native` and `local-wasm` providers with a Llama/Qwen-family tool-calling adapter; safe built-in tools registry (`currentTime`, `mathEval`, `kvLookup`, RAG-search); tool-result rendering |
| **PR 15**   | Voice in / out                           | On-device STT (`whisper.cpp` JNI behind a separate Capacitor plugin or wllama-whisper) + TTS (Android `TextToSpeech`, web `SpeechSynthesis`); push-to-talk; voice-only mode |
| **PR 16**   | Vision / multimodal                      | LLaVA / MiniCPM-V / Llama-3.2-Vision support: image input in `messages`, `mmproj` model loading, OCR fallback path, capability flag in provider |
| **PR 17**   | `offline` product flavor                 | Gradle product flavor `offline` that strips `@wllama/wllama` and any provider that requires a network call; bundled `assets/models/` slot; F-Droid-friendly metadata |
| **PR 18**   | Bundled-model release flavor             | `bundled` flavor that ships a small (≤700 MB) Q4 model in `assets/models/`, lazily extracted to internal storage on first launch; integrity check |
| **PR 19**   | Performance + battery + memory           | tokens/sec meter, thermal throttling watch, low-memory unload, mmap toggle, "low-power chat" preset, Android `PowerManager` integration |
| **PR 20**   | Polish, parity dashboard, store readiness | Side-by-side feature parity dashboard in Settings (TrueAI vs. OfflineLLM checklist computed at runtime), updated `COMPETITIVE_SUMMARY.md` and `TOOLNEURON_COMPARISON.md`, Play Store + F-Droid metadata refresh, Maestro flows for the new surfaces |

---

## 2. Numbering history

This section maps every legacy `PR N` marker that was in the codebase at
the start of PR 3 to its canonical home in the table above. **Read
this whenever you encounter an old marker in `git log` or in a comment
that PR 3 didn't reach.**

### 2.1 Legacy "sub-feature" scheme (lived in test `describe()` strings)

These are all sub-features of the local-wasm foundation that landed in
the merged **PR 1** (#3). They were given separate PR numbers in test
descriptions while #3 was in review. PR 3 of this plan rewrites the
descriptions to use the canonical sub-letter form below.

| Legacy marker                              | Canonical id | Where it lives now |
|--------------------------------------------|--------------|--------------------|
| `PR 2 — context size + sampling defaults`  | **PR 1.b**   | `local-wllama-provider.test.ts`, `client.test.ts`, `config.test.ts`, `LLMRuntimeSettings.tsx` |
| `PR 3 — extended sampling knobs (Top-K / Min-P / Repeat Penalty / Context Size)` | **PR 1.c** | `LLMRuntimeSettings.test.tsx` |
| `PR 4 — per-conversation sampling overrides` | **PR 1.d** | `ConversationSettings.test.tsx`, `types.ts` |
| `PR 6 — local-wllama download progress`    | **PR 1.f**   | `local-wllama-provider.test.ts`, `LLMRuntimeSettings.test.tsx` |
| `PR 7 — sampling controls forwarded to streamText` | **PR 1.g** | `use-streaming-chat.test.ts` |
| `PR 9 — AI-SDK streaming chat path`        | **PR 1.h**   | `App.tsx` chat-routing comments |

### 2.2 Legacy "forward-pointing" scheme (lived in source comments)

Markers that pointed at *future* work whose number changed in the new
master table:

| Legacy marker (in source)             | Now points to | Theme |
|---------------------------------------|---------------|-------|
| `PR-3` in `android/capacitor-llama/**`, `MainActivity.java`, `app/build.gradle`, `src/lib/native/llama.ts`, `llama.android.test.ts` | **PR 4**  | Native streaming + `local-native` provider |
| `PR 4` in `local-wllama-provider.ts` ("the in-app GGUF importer (PR 4)") | **PR 5** | GGUF importer |
| `PR 9` in `AndroidManifest.xml` ("future `offline` product flavor (PR 9)") | **PR 17** | `offline` product flavor |
| `PR 13` in `local-wllama-provider.ts` ("offline product flavor") | **PR 17** | `offline` product flavor |
| `PR 17` in `local-wllama-provider.ts` ("vision") | **PR 16** | Vision / multimodal |

### 2.3 Sub-PR convention

If a row above grows beyond ~1500 LOC of diff, split into `PR N.a`,
`PR N.b`, etc., and add a one-line entry here recording the split. PRs
are tracked as a series, not a single megamerge.

| Split           | Sub-PR  | Scope |
|-----------------|---------|-------|
| **PR 4** split  | **4.a** | Streaming JNI surface, `local-native` AI-SDK provider, ABI matrix expansion (`armeabi-v7a`, `x86_64`), web/iOS auto-fallback to `local-wasm` |
| **PR 4** split  | **4.b** | Small LRU of loaded models (relax `LlamaBridge`'s single-model invariant). Deferred until the streaming surface settles. |

---

## 3. Cross-cutting workstreams

These are not separate PRs; they're checklists that each relevant PR is
expected to satisfy.

- **a. Schema / config migrations.** Whenever `LLMRuntimeConfig` or
  persisted KV shapes change (PRs 4, 7, 8, 11, 12), add a numbered
  migration in `src/lib/llm-runtime/migrations/` and a unit test that
  round-trips a v(N-1) blob.
- **b. Native-test split.** Every new `src/lib/native/<mod>.ts` ships
  *both* `<mod>.test.ts` (jsdom path) and `<mod>.android.test.ts`
  (mocks `./platform` as native, mocks `@capacitor/*` plugin,
  `vi.resetModules()` then re-import inside each test) — pattern
  locked in `secure-storage.android.test.ts`,
  `network.android.test.ts`, `llama.android.test.ts`.
- **c. In-tree Capacitor plugins.** Each new plugin (PR 15 whisper,
  optional PR 13 sqlite-vec) follows the `capacitor-llama` recipe:
  `android/<plugin-name>/` with its own `build.gradle`, included via
  `android/settings.gradle`, registered in `MainActivity.onCreate`
  via `registerPlugin(...class)` **before** `super.onCreate`.
- **d. Provider-factory matrix.** PRs 4, 17, 18 each update the
  snapshot test in `provider-factory.test.ts` so the selection
  matrix stays explicit.
- **e. CHANGELOG + release.** Every merged PR appends a one-line
  entry under `## Unreleased` in `CHANGELOG.md`; release-bump
  workflow (`release-bump.yml`) handles the rest.
- **f. Maestro flows.** PR 20 owns the consolidated flow refresh; in
  the meantime, each feature PR adds a small flow under
  `.maestro/<feature>.yaml` if it introduces a new screen.

---

## 4. Constraints

### Relaxed (per owner request, 2026-05)

- ❌ "One PR per phase" — phases may be split into 2-3 PRs when a
  single diff would be unreviewable (PRs 4, 13, 14 are likely
  candidates).
- ❌ "Zero-warning policy" — new ESLint warnings tolerated *if*
  directly attributable to AI-SDK or wllama type definitions
  outside our control; require an inline `// eslint-disable-next-line`
  with a one-line justification.
- ❌ "AGPL out-of-process only" relaxed to: AGPL upstreams may be
  linked dynamically into the `offline` flavor only (PR 17),
  provided the resulting APK is published under AGPL terms in a
  separate release channel; the default flavor remains MIT-clean.
- ❌ "No `.github/**` edits unless required" — PRs that genuinely
  need workflow changes (e.g., adding a Vulkan-build CI matrix in
  PR 9) may touch `.github/workflows/` directly.

### Kept (non-negotiable)

- ✅ `LICENSE`, `NOTICE`, in-source copyright headers — never modified.
- ✅ `package.json` `overrides` floor (`path-to-regexp ^8.4.0`,
  `postcss ^8.5.10`, `lodash ^4.17.24`,
  `brace-expansion@1 ^1.1.13`) — pins may be tightened, never weakened.
- ✅ No telemetry, no analytics, no third-party network calls in
  the default flavor.
- ✅ Credential storage stays exclusively under
  `__llm_runtime_api_key__` via `secureStorage` /
  `kvStore.setSecure` (regression test in `kv-store.test.ts`
  keeps passing).
- ✅ Toolchain pin: Node 24 / npm 11 / JDK Temurin 21.
- ✅ CodeQL `Analyze (javascript-typescript)` and
  `Analyze (java-kotlin)` must remain green.

---

## 5. Suggested execution order (next 4 PRs)

1. **PR 3** (this plan + numbering renumber) — small, doc-heavy,
   unblocks everything.
2. **PR 4** — biggest single user-visible win (Android users get
   on-device inference for real).
3. **PR 5** — unblocks "bring your own model" workflow that PR 18's
   bundled flavor and PR 13's RAG both rely on for testing.
4. **PR 7** — high-value UX polish that fits in a small diff and
   lands the first OfflineLLM-style preset chips.

PRs 6, 8, 9, 10, 11 can interleave depending on reviewer bandwidth.
PRs 13–16 are larger and should each be split if they exceed ~1500
LOC of diff.
