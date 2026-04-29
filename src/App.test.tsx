import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock all lazy-loaded heavy components
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
vi.mock('@/lib/analytics', () => ({
  analytics: {
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
  useAutoPerformanceOptimization: () => ({
    isOptimizing: false,
  }),
}))
vi.mock('@/hooks/use-touch-gestures', () => ({
  useSwipeGesture: () => {},
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
    getCacheStats: vi.fn().mockResolvedValue(null),
  }),
}))
vi.mock('@/hooks/use-dynamic-ui', () => ({
  useDynamicUI: () => ({
    config: {},
    layout: 'default',
    updateConfig: vi.fn(),
    suggestions: [],
  }),
}))
vi.mock('@/hooks/use-contextual-ui', () => ({
  useContextualUI: () => ({
    suggestions: [],
    recordUserAction: vi.fn(),
  }),
}))
vi.mock('@/hooks/use-tab-preloader', () => ({
  useTabPreloader: () => ({ preloadedTabs: new Set() }),
}))
vi.mock('@/hooks/use-data-prefetcher', () => ({
  useSmartPrefetch: () => ({
    prefetchedKeys: new Set(),
  }),
}))
vi.mock('@/components/ui/dynamic-ui-customizer', () => ({
  DynamicUICustomizer: () => null,
}))
vi.mock('@/components/ui/dynamic-ui-dashboard', () => ({
  DynamicUIDashboard: () => null,
}))
vi.mock('@/components/ui/contextual-suggestions', () => ({
  ContextualSuggestionsPanel: () => null,
}))
vi.mock('@/components/ui/smart-layout', () => ({
  DynamicBackground: () => null,
}))
vi.mock('@/lib/performance-profiles', () => ({
  defaultProfilesByTaskType: {},
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  Toaster: () => null,
}))
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

import App from './App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(document.body).toBeTruthy()
  })

  it('renders tab bar with chat tab', () => {
    render(<App />)
    // The tab bar should have Chat tab
    expect(screen.getByRole('tab', { name: /chat/i })).toBeInTheDocument()
  })

  it('renders agents tab', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: /agents/i })).toBeInTheDocument()
  })

  it('renders models tab', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: /models/i })).toBeInTheDocument()
  })

  it('renders analytics tab', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: /analytics/i })).toBeInTheDocument()
  })

  it('starts on chat tab by default', () => {
    render(<App />)
    const chatTab = screen.getByRole('tab', { name: /chat/i })
    expect(chatTab).toHaveAttribute('data-state', 'active')
  })

  it('renders gear icon button to open settings', () => {
    render(<App />)
    const gearBtn = screen.getByRole('button', { name: /settings/i })
    expect(gearBtn).toBeInTheDocument()
  })

  it('opens settings menu when gear icon is clicked', () => {
    render(<App />)
    const gearBtn = screen.getByRole('button', { name: /settings/i })
    fireEvent.click(gearBtn)
    expect(screen.getByTestId('settings-menu')).toBeInTheDocument()
  })

  it('switches to agents tab when clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: /agents/i }))
    expect(screen.getByRole('tab', { name: /agents/i })).toHaveAttribute('data-state', 'active')
  })
})
