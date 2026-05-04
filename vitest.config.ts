import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Per-test timeout. The default of 5s is tight for jsdom + v8 coverage
    // instrumentation under worker contention; several heavy component
    // tests (HarnessCreator, PromptTemplates, Calendar/DayPicker) flake
    // under combined load. 15s preserves real-failure detection while
    // absorbing CI noise.
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
      thresholds: {
        // Pragmatic floors set to lock in the gains from PRs #59–#67 and the
        // Phase A–E coverage push (TEST_COVERAGE_SUMMARY.md). The aspirational
        // 80/75 targets are blocked by a handful of large untested screens
        // (`App.tsx`, `AppBuilder.tsx`, `LocalIDE.tsx`) that need
        // decomposition first; tightening these numbers is a follow-up.
        //
        // Phase 1.4 (Master Coverage Roadmap, see docs/COVERAGE_ROADMAP.md):
        // ratcheted up from 65/53/53/63 to the rounded-down current baseline
        // (lines 65.77% · functions 54.05% · branches 54.56% · statements
        // 63.64%) so any future regression fails CI immediately. Subsequent
        // Phase 2 PRs will continue to ratchet these floors upward.
        //
        // Phase 3: ratcheted up from 65.5/54/54/63.5 to the rounded-down
        // Phase 3 baseline (lines 79.52% · functions 68.29% · branches 69.11%
        // · statements 77.27%) — +41 new tests across use-indexeddb-cache,
        // AnalyticsDashboard, ConversationSettings, ModelConfigPanel,
        // AppearanceSettings.
        //
        // Phase 5: ratcheted up from 79/68/69/77 to rounded-down Phase 5
        // baseline (lines 79.76% · functions 68.91% · branches 69.41% ·
        // statements 77.53%) — +57 new tests across NotificationSettings,
        // SettingsMenu, QuickActionsMenu, GGUFLibrary, AdvancedSettings,
        // GeneralSettings, AISettings.
        //
        // Phase 6: ratcheted up from 79/68/69/77 to rounded-down Phase 6
        // baseline (lines 80.08% · functions 69.14% · branches 69.6% ·
        // statements 77.84%) — +17 new branch-coverage tests across
        // IndexedDBCacheManager (formatDate display, cleanup/clear/export
        // error toasts, file-import flow + error + no-file path, mount
        // getCacheStats rejection), CostTracking (exportData blob/anchor
        // flow, createBudget invalid-form early-returns, alertThreshold
        // input incl. NaN fallback, Cancel button), and OfflineQueuePanel
        // (retryFailed failure toast, failed/syncing status badges with
        // retryCount + error rendering, unknown-status fallback).
        // Phase 7: ratcheted up from 80/69/69/77 to rounded-down Phase 7
        // baseline (lines 80.71% · functions 70.58% · branches 70.04% ·
        // statements 78.41%) — +24 new tests across LLMRuntimeSettings
        // (apiKey/defaultModel inputs, temperature/topP/maxTokens with NaN
        // and timeout floor clamps, save error toast, datalist suggestions,
        // truncated >12-models display), DataSettings (import-success branch
        // including spark.kv writes + reload), ServiceWorkerUpdate
        // (updatefound + statechange installed-while-controller branch and
        // null-installing branch), and shadcn primitive smoke tests
        // (Accordion, AspectRatio, Breadcrumb incl. asChild + custom
        // separator, Collapsible, Drawer open with header/footer/close,
        // Pagination with active link + ellipsis, Table full layout,
        // Toggle variants, ToggleGroup with items).
        //
        // Phase 8: ratcheted up from 80/70/70/78 to rounded-down Phase 8
        // baseline (lines 81.19% · functions 71.29% · branches 70.24% ·
        // statements 78.84%) — +8 shadcn primitive smoke tests for HoverCard
        // (open with custom align/sideOffset), Resizable (panel group with
        // and without grip handle), InputOTP (group/slot via OTPInputContext
        // + separator), DropdownMenu (open with label/group/items/variants/
        // separator/shortcut/checkbox/radio group), Form (FormField/FormItem/
        // FormLabel/FormControl/FormDescription/FormMessage with both
        // children-fallback and error-message branches), and Sonner Toaster
        // (renders with next-themes default theme).
        //
        // Phase 9: ratcheted up from 81/71/70/78 to rounded-down Phase 9
        // baseline (lines 82.25% · functions 72.08% · branches 71.83% ·
        // statements 79.83%) — +11 new tests for two previously 0%-covered
        // shadcn primitives: Carousel (horizontal/vertical orientation,
        // setApi callback, ArrowLeft/ArrowRight key handlers exercising
        // scrollPrev/scrollNext) and Chart (ChartContainer + ChartStyle CSS
        // variable generation incl. theme/color/sanitizeColor reject branches,
        // ChartTooltipContent active/inactive/labelFormatter/formatter/
        // hideIndicator/dashed branches, ChartLegendContent label rendering
        // and empty-payload null branch).
        //
        // Phase 10: ratcheted branches from 71 → 72; other floors unchanged.
        // Baseline (lines 82.39% · functions 72.33% · branches 72.00% ·
        // statements 79.96%) — +14 tests across shadcn-primitives.test.tsx
        // (Select sub-components Group/Label/Item/Separator inside an open
        // Select; Avatar root + AvatarImage + AvatarFallback; Dialog Trigger
        // + Close inside an open Dialog; PopoverAnchor alongside open
        // Popover; Sheet Close + Footer inside an open Sheet plus
        // SheetContent side=left/top/bottom variant branches via it.each)
        // and swipeable-card.test.tsx (handleDragEnd via framer-motion
        // motion.div mock that captures onDragEnd: offset.x < -threshold
        // calls onSwipeLeft, > threshold calls onSwipeRight, within
        // threshold calls neither, and past-threshold drags without
        // callbacks are no-ops). Took select.tsx, avatar.tsx, dialog.tsx,
        // popover.tsx, sheet.tsx all to 100% lines.
        // Phase 2.8 (App shell — `src/App.tsx`): ratcheted up from
        // lines 82/functions 72/branches 72/statements 79 to the
        // rounded-down post-2.8 baseline (lines 83.37% · functions
        // 73.72% · branches 73.27% · statements 81.00%) — +12 tests
        // in `src/App.routing.test.tsx` covering `App.tsx` seams that
        // the existing smoke test deliberately avoided: `isTabName`
        // guard (valid / invalid / wrong-type persisted active-tab),
        // top-level Tabs `handleTabChange` routing for all 6 tabs,
        // tab-trigger hover handlers, header icon-button dialog open
        // paths (Settings, Customize), `createConversation` create +
        // cancel flows, mobile shell (`useIsMobile=true`)
        // MobileBottomNav + chat-tab FloatingActionButton
        // conditional, agents-tab sub-tab walk + `createAgent`
        // dialog flow including `toggleAgentTool`. Took
        // `src/App.tsx` from 21.5/14.8/5.3/26.6 (stmt/br/fn/lines)
        // to 29.9/22.9/18.0/34.5. Heavy event handlers (`runAgent`,
        // `executeWorkflow`, `sendMessage`, `triggerLearning`)
        // remain follow-up slices per the roadmap's
        // "post-decomposition" caveat.
        //
        // Phase 2.9 (2026-05-04 — leaf-hook branch density): ratcheted
        // branches 73 → 73 (rounded-down baseline 73.52%, up from
        // 73.27%) and statements 80 → 81 (baseline 81.12%, up from
        // 81.00%). Lines 83.44% (was 83.37%); functions 73.83% (no
        // material change — was 73.72%, lossy due to one excluded
        // pre-existing failing test file). Two leaf hooks taken to
        // ≥96% lines / ≥86% branches: **`src/hooks/use-streaming-chat.ts`**
        // L 94.8→**96.55**, B **68.2→86.36** (+5 tests covering the
        // `system` prompt prepend branch, mid-stream error parts via
        // the `onError → streamError → throw` path, non-Error onError
        // payload wrapped into Error, non-Error throw from
        // model.doStream wrapped in the catch block, and the
        // user-aborted-during-send catch path via a never-ending
        // ReadableStream that errors on AbortSignal); and
        // **`src/hooks/use-contextual-ui.ts`** L 94.4→**100**,
        // B 67.7→**100** (+12 tests: parametrized time-of-day buckets
        // for morning/afternoon/evening/night, plus a null-behavior
        // `describe` block that overrides the `useKV` mock to return
        // `null` to exercise every `prev ?? initialBehavior` and
        // `prev || []` fallback in `trackFeatureUsage` /
        // `trackTimeOfDay` / `trackError` / `trackSessionDuration` /
        // `dismissSuggestion`, and the `if (!behavior)` early returns
        // in `generateSuggestions` / `getPredictedNextAction` /
        // `getRecommendedFeatures`).
        // **Threshold ratchet (post-PRs #102/#104/#105/#106):** all-files
        // now sits at 84.21 stmts · 76.15 branch · 78.71 funcs · 86.38
        // lines (218/218 files, 3107/3107 tests). Bumped from
        // 83.5 / 75 / 77 / 85 to 84 / 76 / 78 / 86 to lock in the gains
        // from PRs #102 (PerfProfile/QuickActions/useAgent), #104
        // (agent-tools error paths), #105 (diagnostics edge branches),
        // and #106 (analytics rollups + day bucketing).
        lines: 86,
        functions: 78,
        branches: 76,
        statements: 84,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // Mirror the Vite alias so tests that import components which use
      // `useKV` from `@github/spark/hooks` resolve to the local IndexedDB-
      // backed shim instead of the published Spark dist bundle (which reads
      // `import.meta.env.DEV` in a way that throws under Vitest).
      '@github/spark/hooks': resolve(__dirname, 'src/lib/llm-runtime/spark-hooks-shim.ts'),
      '@github/spark/spark': resolve(__dirname, 'src/lib/llm-runtime/install.ts'),
    }
  },
})
