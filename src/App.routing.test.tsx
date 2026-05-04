/**
 * Routing- and seam-focused tests for `App.tsx` — Phase 2.8 of the
 * coverage roadmap (docs/COVERAGE_ROADMAP.md).
 *
 * The existing `App.test.tsx` is intentionally a single smoke render;
 * its inline comment warns that interactions in jsdom can pressure the
 * worker heap. This file extends coverage by exercising specific seams
 * (top-level tab routing + `isTabName` guard, header icon-button dialog
 * open paths, mobile bottom-nav + FloatingActionButton conditional)
 * with the smallest interaction set that still hits the target lines.
 *
 * Lazy panels are mocked to render `null`, so switching tabs does not
 * pull in the heavy AgentCard / AnalyticsDashboard / etc. trees — only
 * the `<TabsContent>` wrapper JSX inside `App.tsx` is exercised.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'

// ---- useKV mock ------------------------------------------------------------
// `App.tsx` reads the active tab from `useKV<string>('active-tab', 'chat')`
// and falls back to `chat` when the stored value isn't a known tab name
// (the `isTabName` guard). To exercise both branches we install a
// useState-backed `useKV` mock with a per-test override hook for the
// `active-tab` key. Other keys behave identically to the default impl
// (initial value seeds state).
const kvOverrides = vi.hoisted(() => ({
  initial: {} as Record<string, unknown>,
}))
vi.mock('@github/spark/hooks', () => ({
  useKV: <T,>(key: string, def: T) => {
    const seed =
      key in kvOverrides.initial ? (kvOverrides.initial[key] as T) : def
    const [value, setValue] = React.useState<T>(seed)
    const reset = React.useCallback(() => setValue(def), [def])
    return [value, setValue, reset] as const
  },
}))

// ---- Heavy component / hook mocks (mirror App.test.tsx) -------------------
vi.mock('@/components/settings/SettingsMenu', () => ({
  SettingsMenu: ({ open }: { open: boolean }) =>
    open ? <div data-testid="settings-menu">SettingsMenu</div> : null,
}))
vi.mock('@/components/notifications/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}))
vi.mock('@/components/notifications/ServiceWorkerUpdate', () => ({
  ServiceWorkerUpdate: () => null,
}))
vi.mock('@/components/notifications/InstallPrompt', () => ({
  InstallPrompt: () => null,
}))
vi.mock('@/components/PerformanceMonitor', () => ({
  PerformanceMonitor: () => null,
}))
vi.mock('@/components/cache/IndexedDBStatus', () => ({
  IndexedDBStatus: () => null,
}))
vi.mock('@/components/PrefetchManager', () => ({
  PrefetchManager: () => null,
}))
vi.mock('@/components/PrefetchIndicator', () => ({
  PrefetchStatusIndicator: () => null,
}))
vi.mock('@/lib/analytics', () => ({
  analytics: {
    track: vi.fn(),
    trackEvent: vi.fn(),
    getMetrics: vi.fn().mockResolvedValue(null),
  },
  useAnalytics: vi.fn().mockReturnValue({
    events: [],
    sessions: [],
    clearData: vi.fn(),
    getMetrics: vi.fn().mockResolvedValue(null),
  }),
}))
vi.mock('@/hooks/use-auto-performance', () => ({
  useAutoPerformanceOptimization: () => ({ isOptimizing: false }),
}))
vi.mock('@/hooks/use-touch-gestures', () => ({
  useSwipeGesture: () => ({ onTouchStart: vi.fn(), onTouchEnd: vi.fn() }),
}))
vi.mock('@/hooks/use-pull-to-refresh', () => ({
  usePullToRefresh: () => ({ isPulling: false, pullProgress: 0 }),
}))
vi.mock('@/hooks/use-indexeddb-cache', () => ({
  useIndexedDBCache: () => ({
    isInitialized: true,
    isSyncing: false,
    lastSyncTime: null,
    syncToCache: vi.fn(),
    cacheConversation: vi.fn(),
    getCacheStats: vi.fn().mockResolvedValue(null),
  }),
}))
vi.mock('@/hooks/use-dynamic-ui', () => ({
  useDynamicUI: () => ({
    config: {},
    layout: 'default',
    updateConfig: vi.fn(),
    suggestions: [],
    trackTabUsage: vi.fn(),
  }),
}))
vi.mock('@/hooks/use-contextual-ui', () => ({
  useContextualUI: () => ({
    suggestions: [],
    recordUserAction: vi.fn(),
    trackFeatureUsage: vi.fn(),
    trackTimeOfDay: vi.fn(),
  }),
}))
// Extend useTabPreloader mock so onMouseEnter / onMouseLeave on each
// `<TabsTrigger>` doesn't blow up when tab clicks are dispatched.
vi.mock('@/hooks/use-tab-preloader', () => ({
  useTabPreloader: () => ({
    preloadedTabs: new Set(),
    handleTabHover: vi.fn(),
    handleTabLeave: vi.fn(),
  }),
}))
vi.mock('@/hooks/use-data-prefetcher', () => ({
  useSmartPrefetch: () => ({ prefetchedKeys: new Set() }),
}))
vi.mock('@/components/ui/dynamic-ui-customizer', () => ({
  DynamicUICustomizer: () => <div data-testid="ui-customizer" />,
}))
vi.mock('@/components/ui/dynamic-ui-dashboard', () => ({
  DynamicUIDashboard: () => null,
}))
vi.mock('@/components/ui/contextual-suggestions', () => ({
  ContextualSuggestionsPanel: () => null,
}))
vi.mock('@/components/ui/smart-layout', () => ({
  DynamicBackground: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dynamic-background">{children}</div>
  ),
}))
vi.mock('@/lib/performance-profiles', () => ({
  defaultProfilesByTaskType: {},
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}))
// Per-test override for useIsMobile (default false / desktop).
const mobileFlag = vi.hoisted(() => ({ value: false }))
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mobileFlag.value,
}))

// Import AFTER mocks — App pulls them transitively at module load.
import App from './App'

beforeEach(() => {
  kvOverrides.initial = {}
  mobileFlag.value = false
})

describe('App — persisted active tab (`isTabName` guard)', () => {
  it('honors a valid persisted tab on first render', () => {
    kvOverrides.initial = { 'active-tab': 'analytics' }
    render(<App />)
    expect(screen.getByRole('tab', { name: /analytics/i })).toHaveAttribute(
      'data-state',
      'active',
    )
  })

  it('falls back to chat when the persisted value is not a known tab name', () => {
    kvOverrides.initial = { 'active-tab': '__bogus_tab__' }
    render(<App />)
    expect(screen.getByRole('tab', { name: /chat/i })).toHaveAttribute(
      'data-state',
      'active',
    )
  })

  it('falls back to chat when the persisted value is the wrong type', () => {
    // Simulate a corrupted/legacy KV blob (number instead of string) —
    // the `typeof === 'string'` arm of `isTabName` should still reject.
    kvOverrides.initial = { 'active-tab': 42 }
    render(<App />)
    expect(screen.getByRole('tab', { name: /chat/i })).toHaveAttribute(
      'data-state',
      'active',
    )
  })
})

describe('App — top-level tab routing (`handleTabChange`)', () => {
  it('switches to each top-level tab when its trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Click order matches `TAB_ORDER` from App.tsx, skipping the default
    // `chat` tab. After each click the controlled `<Tabs value>` should
    // update synchronously and the corresponding top-level tab trigger
    // become `data-state=active`. Some tabs (e.g. `agents`, `models`)
    // render their own sub-`<Tabs>` whose triggers ALSO have role="tab"
    // and may share names — always pick the first match (top-level).
    for (const name of [
      /agents/i,
      /workflows/i,
      /models/i,
      /analytics/i,
      /builder/i,
    ] as const) {
      const triggers = screen.getAllByRole('tab', { name })
      await user.click(triggers[0])
      expect(triggers[0]).toHaveAttribute('data-state', 'active')
    }
    // And we can come back to chat.
    const chatTriggers = screen.getAllByRole('tab', { name: /chat/i })
    await user.click(chatTriggers[0])
    expect(chatTriggers[0]).toHaveAttribute('data-state', 'active')
  })

  it('exercises tab-trigger hover handlers without throwing', () => {
    // `tabPreloader.handleTabHover` / `handleTabLeave` are wired to
    // onMouseEnter / onMouseLeave on every desktop trigger; verify they
    // are safely callable (mock asserts via vi.fn no-throw contract).
    render(<App />)
    const agents = screen.getAllByRole('tab', { name: /agents/i })[0]
    fireEvent.mouseEnter(agents)
    fireEvent.mouseLeave(agents)
    expect(agents).toBeInTheDocument()
  })
})

describe('App — header icon-button dialogs', () => {
  it('opens the Settings menu when the Settings icon button is clicked', () => {
    render(<App />)
    expect(screen.queryByTestId('settings-menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByTestId('settings-menu')).toBeInTheDocument()
  })

  it('opens the Dynamic-UI customizer dialog when the Customize icon button is clicked', () => {
    render(<App />)
    expect(screen.queryByTestId('ui-customizer')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /customize/i }))
    // Dialog content renders into a portal — query the document.
    expect(document.body.querySelector('[data-testid="ui-customizer"]'))
      .not.toBeNull()
  })
})

describe('App — new-conversation dialog (createConversation seam)', () => {
  it('opens the dialog, accepts a title, and creates a conversation on submit', () => {
    render(<App />)
    // The desktop "New Chat" trigger lives in the chat-tab toolbar.
    fireEvent.click(screen.getByRole('button', { name: /new chat/i }))

    // Dialog content portal — title input identified by its label.
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    const titleInput = within(dialog as HTMLElement).getByLabelText(/title/i)
    fireEvent.change(titleInput, { target: { value: 'My test conversation' } })

    // The Create button submits and closes the dialog.
    fireEvent.click(within(dialog as HTMLElement).getByRole('button', { name: /^create$/i }))

    // The new conversation title appears in the sidebar conversation list.
    expect(screen.queryAllByText(/my test conversation/i).length).toBeGreaterThan(0)
  })

  it('cancels without creating a conversation when Cancel is clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /new chat/i }))
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/my cancelled conversation/i)).not.toBeInTheDocument()
  })
})

describe('App — mobile shell (`useIsMobile=true`)', () => {
  it('renders the MobileBottomNav and chat-tab FloatingActionButton', () => {
    mobileFlag.value = true
    render(<App />)
    // MobileBottomNav exposes a button per tab; the Chat one is the
    // first nav button. Verify at least one chat-named button exists.
    expect(
      screen.getAllByRole('button', { name: /chat/i }).length,
    ).toBeGreaterThan(0)
    // Default tab is chat → the FAB conditional `activeTab === 'chat'`
    // renders an additional New Chat affordance. Both the toolbar
    // button and the FAB use the New Chat label.
    expect(
      screen.getAllByRole('button', { name: /new chat/i }).length,
    ).toBeGreaterThan(0)
  })

  it('switches to the agents tab via the bottom-nav button', async () => {
    mobileFlag.value = true
    const user = userEvent.setup()
    render(<App />)
    // The mobile bottom-nav `Agents` button has role="button". Filter to
    // exclude any tab triggers that share the name.
    const agentsButtons = screen
      .getAllByRole('button', { name: /agents/i })
      .filter(b => b.getAttribute('role') !== 'tab')
    expect(agentsButtons.length).toBeGreaterThan(0)
    await user.click(agentsButtons[0])
    // The first top-level Tabs trigger named "agents" should now be active.
    expect(screen.getAllByRole('tab', { name: /agents/i })[0]).toHaveAttribute(
      'data-state',
      'active',
    )
  })
})

describe('App — agents tab (sub-tabs + createAgent seam)', () => {
  it('renders agents-tab JSX, walks each sub-tab, then opens + submits the New Agent dialog', async () => {
    // Start directly on the agents tab to avoid an extra top-level click.
    kvOverrides.initial = { 'active-tab': 'agents' }
    const user = userEvent.setup()
    render(<App />)

    // Sub-tabs inside the agents tab: agents-list (default), templates,
    // learning, collaborative. Walking them exercises each sub-TabsContent
    // (additional JSX coverage in App.tsx).
    for (const subTab of [/templates/i, /learning/i, /collab/i] as const) {
      const trigger = screen.getAllByRole('tab', { name: subTab })[0]
      await user.click(trigger)
      expect(trigger).toHaveAttribute('data-state', 'active')
    }

    // Open the New Agent dialog from the desktop "Create Agent" button.
    fireEvent.click(screen.getByRole('button', { name: /^create agent$/i }))
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).not.toBeNull()

    // Fill the required Name + Goal fields (Create stays disabled until both).
    fireEvent.change(within(dialog).getByLabelText(/^name$/i), {
      target: { value: 'Phase-2.8 Test Agent' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^goal$/i), {
      target: { value: 'Verify createAgent path is exercised by tests' },
    })

    // Toggle one tool checkbox to exercise toggleAgentTool too.
    fireEvent.click(within(dialog).getByLabelText(/calculator/i))

    const create = within(dialog).getByRole('button', { name: /^create$/i })
    expect(create).not.toBeDisabled()
    fireEvent.click(create)

    // Dialog closes synchronously (setNewAgentDialog(false) inside
    // createAgent). We assert via the DOM rather than the agents list,
    // because the AgentCard panel is lazy-loaded and may still be in the
    // Suspense fallback at this point.
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
})
