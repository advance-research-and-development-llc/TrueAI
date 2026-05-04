import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'

const { mockUseAnalytics } = vi.hoisted(() => ({
  mockUseAnalytics: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  useAnalytics: mockUseAnalytics,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@github/spark/hooks', () => ({
  useKV: vi.fn((key: string, defaultValue: unknown) => [defaultValue, vi.fn()]),
}))

// Blob/URL stubs
beforeAll(() => {
  if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:mock')
  if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn()
  HTMLElement.prototype.scrollIntoView = () => {}
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false
    HTMLElement.prototype.setPointerCapture = () => {}
    HTMLElement.prototype.releasePointerCapture = () => {}
  }
})

import { AnalyticsDashboard } from './AnalyticsDashboard'

// Minimal AnalyticsMetrics shape so the dashboard exits its loading state
// and renders the tablist + heading. Must include every nested field the
// dashboard reads (topActions, chatMetrics, agentMetrics, modelMetrics, …).
const noopMetrics = {
  totalEvents: 0,
  totalSessions: 0,
  averageSessionDuration: 0,
  activeUsers: 0,
  eventsByType: [],
  eventsByDay: [],
  topActions: [],
  errorRate: 0,
  chatMetrics: {
    totalMessages: 0,
    totalConversations: 0,
    averageMessagesPerConversation: 0,
    averageResponseTime: 0,
    mostUsedModels: [],
  },
  agentMetrics: {
    totalAgents: 0,
    totalRuns: 0,
    successRate: 0,
    averageExecutionTime: 0,
    mostUsedTools: [],
  },
  modelMetrics: {
    totalModels: 0,
    totalDownloads: 0,
    mostPopularModels: [],
    storageUsed: 0,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

const makeHookValue = (overrides = {}) => ({
  getMetrics: vi.fn().mockResolvedValue(noopMetrics),
  events: [],
  sessions: [],
  clearData: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AnalyticsDashboard', () => {
  it('renders without crashing when analytics is undefined', async () => {
    mockUseAnalytics.mockReturnValue(undefined)
    render(<AnalyticsDashboard />)
    // While loading, the spinner copy includes "Loading analytics..."
    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument()
  })

  it('renders with empty analytics hook', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /analytics dashboard/i })
      ).toBeInTheDocument()
    })
  })

  it('renders tab navigation', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => {
      expect(document.querySelector('[role="tablist"]')).toBeTruthy()
    })
  })

  it('shows Refresh button', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('button', { name: /refresh/i }))
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('shows Export button', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('button', { name: /export/i }))
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('shows Clear Data button', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('button', { name: /clear data/i }))
    expect(screen.getByRole('button', { name: /clear data/i })).toBeInTheDocument()
  })

  it('shows Resume/Pause auto-refresh button', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('button', { name: /resume/i }))
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
  })

  it('clicking Resume shows Pause button', async () => {
    const user = userEvent.setup()
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('button', { name: /resume/i }))
    await user.click(screen.getByRole('button', { name: /resume/i }))
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  it('clicking Export calls toast success', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('button', { name: /export/i }))
    await user.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Analytics data exported'))
  })

  it('clicking Refresh calls getMetrics', async () => {
    const user = userEvent.setup()
    const getMetrics = vi.fn().mockResolvedValue(noopMetrics)
    mockUseAnalytics.mockReturnValue(makeHookValue({ getMetrics }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('button', { name: /refresh/i }))
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    await waitFor(() => expect(getMetrics).toHaveBeenCalledTimes(2)) // once on mount, once on click
  })

  it('shows Updates paused badge when not auto-refreshing', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByText(/updates paused/i))
    expect(screen.getByText(/updates paused/i)).toBeInTheDocument()
  })

  it('shows MetricCard for Total Events', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue({
      getMetrics: vi.fn().mockResolvedValue({ ...noopMetrics, totalEvents: 42 }),
    }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByText('Total Events'))
    expect(screen.getByText('Total Events')).toBeInTheDocument()
  })

  it('shows MetricCard for Error Rate', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByText('Error Rate'))
    expect(screen.getByText('Error Rate')).toBeInTheDocument()
  })

  it('shows Overview tab content by default', async () => {
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /overview/i }))
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument()
  })

  it('clear data button triggers confirm and then clearData', async () => {
    const user = userEvent.setup()
    const clearData = vi.fn().mockResolvedValue(undefined)
    mockUseAnalytics.mockReturnValue(makeHookValue({ clearData }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('button', { name: /clear data/i }))
    await user.click(screen.getByRole('button', { name: /clear data/i }))
    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(clearData).toHaveBeenCalled())
  })

  it('clear data does nothing when user cancels confirm', async () => {
    const user = userEvent.setup()
    const clearData = vi.fn().mockResolvedValue(undefined)
    mockUseAnalytics.mockReturnValue(makeHookValue({ clearData }))
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('button', { name: /clear data/i }))
    await user.click(screen.getByRole('button', { name: /clear data/i }))
    expect(clearData).not.toHaveBeenCalled()
  })

  it('shows error toast when getMetrics rejects', async () => {
    const { toast } = await import('sonner')
    const getMetrics = vi.fn().mockRejectedValue(new Error('oops'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUseAnalytics.mockReturnValue(makeHookValue({ getMetrics }))
    render(<AnalyticsDashboard />)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to load analytics'))
  })

  it('switching to Chat tab shows Total Messages metric', async () => {
    const user = userEvent.setup()
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^chat$/i }))
    await user.click(screen.getByRole('tab', { name: /^chat$/i }))
    expect(screen.getAllByText('Total Messages').length).toBeGreaterThan(0)
  })

  it('switching to Agents tab shows Total Agents metric', async () => {
    const user = userEvent.setup()
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^agents$/i }))
    await user.click(screen.getByRole('tab', { name: /^agents$/i }))
    expect(screen.getAllByText('Total Agents').length).toBeGreaterThan(0)
  })

  it('switching to Models tab shows Total Models metric', async () => {
    const user = userEvent.setup()
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^models$/i }))
    await user.click(screen.getByRole('tab', { name: /^models$/i }))
    expect(screen.getAllByText('Total Models').length).toBeGreaterThan(0)
  })

  it('shows formatDuration in seconds when averageResponseTime >= 1000ms', async () => {
    const user = userEvent.setup()
    const metrics = {
      ...noopMetrics,
      chatMetrics: { ...noopMetrics.chatMetrics, averageResponseTime: 2500 },
    }
    mockUseAnalytics.mockReturnValue(makeHookValue({
      getMetrics: vi.fn().mockResolvedValue(metrics),
    }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^chat$/i }))
    await user.click(screen.getByRole('tab', { name: /^chat$/i }))
    // 2500ms → "2.5s"
    await waitFor(() => expect(screen.getAllByText('2.5s').length).toBeGreaterThan(0))
  })

  it('shows formatDuration in minutes when averageResponseTime >= 60000ms', async () => {
    const user = userEvent.setup()
    const metrics = {
      ...noopMetrics,
      chatMetrics: { ...noopMetrics.chatMetrics, averageResponseTime: 90000 },
    }
    mockUseAnalytics.mockReturnValue(makeHookValue({
      getMetrics: vi.fn().mockResolvedValue(metrics),
    }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^chat$/i }))
    await user.click(screen.getByRole('tab', { name: /^chat$/i }))
    // 90000ms → "1m 30s"
    await waitFor(() => expect(screen.getAllByText('1m 30s').length).toBeGreaterThan(0))
  })

  it('shows formatBytes in KB for models storageUsed', async () => {
    const user = userEvent.setup()
    const metrics = {
      ...noopMetrics,
      modelMetrics: { ...noopMetrics.modelMetrics, storageUsed: 2048 },
    }
    mockUseAnalytics.mockReturnValue(makeHookValue({
      getMetrics: vi.fn().mockResolvedValue(metrics),
    }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^models$/i }))
    await user.click(screen.getByRole('tab', { name: /^models$/i }))
    await waitFor(() => expect(screen.getAllByText('2.0 KB').length).toBeGreaterThan(0))
  })

  it('shows formatBytes in MB for larger storageUsed', async () => {
    const user = userEvent.setup()
    const metrics = {
      ...noopMetrics,
      modelMetrics: { ...noopMetrics.modelMetrics, storageUsed: 2 * 1024 * 1024 },
    }
    mockUseAnalytics.mockReturnValue(makeHookValue({
      getMetrics: vi.fn().mockResolvedValue(metrics),
    }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^models$/i }))
    await user.click(screen.getByRole('tab', { name: /^models$/i }))
    await waitFor(() => expect(screen.getAllByText('2.0 MB').length).toBeGreaterThan(0))
  })

  it('shows formatBytes in GB for very large storageUsed', async () => {
    const user = userEvent.setup()
    const metrics = {
      ...noopMetrics,
      modelMetrics: { ...noopMetrics.modelMetrics, storageUsed: 2 * 1024 * 1024 * 1024 },
    }
    mockUseAnalytics.mockReturnValue(makeHookValue({
      getMetrics: vi.fn().mockResolvedValue(metrics),
    }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^models$/i }))
    await user.click(screen.getByRole('tab', { name: /^models$/i }))
    await waitFor(() => expect(screen.getAllByText('2.00 GB').length).toBeGreaterThan(0))
  })

  it('shows agents successRate > 80 renders ArrowUp indicator', async () => {
    const user = userEvent.setup()
    const metrics = {
      ...noopMetrics,
      agentMetrics: { ...noopMetrics.agentMetrics, successRate: 90 },
    }
    mockUseAnalytics.mockReturnValue(makeHookValue({
      getMetrics: vi.fn().mockResolvedValue(metrics),
    }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^agents$/i }))
    await user.click(screen.getByRole('tab', { name: /^agents$/i }))
    await waitFor(() => expect(screen.getAllByText('90.0%').length).toBeGreaterThan(0))
  })

  it('shows agents successRate <= 80 renders ArrowDown indicator', async () => {
    const user = userEvent.setup()
    const metrics = {
      ...noopMetrics,
      agentMetrics: { ...noopMetrics.agentMetrics, successRate: 50 },
    }
    mockUseAnalytics.mockReturnValue(makeHookValue({
      getMetrics: vi.fn().mockResolvedValue(metrics),
    }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^agents$/i }))
    await user.click(screen.getByRole('tab', { name: /^agents$/i }))
    await waitFor(() => expect(screen.getAllByText('50.0%').length).toBeGreaterThan(0))
  })

  it('shows formatDuration in ms for short durations', async () => {
    const user = userEvent.setup()
    const metrics = {
      ...noopMetrics,
      chatMetrics: { ...noopMetrics.chatMetrics, averageResponseTime: 500 },
    }
    mockUseAnalytics.mockReturnValue(makeHookValue({
      getMetrics: vi.fn().mockResolvedValue(metrics),
    }))
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^chat$/i }))
    await user.click(screen.getByRole('tab', { name: /^chat$/i }))
    await waitFor(() => expect(screen.getAllByText('500ms').length).toBeGreaterThan(0))
  })

  it('shows N/A when mostPopularModels is empty', async () => {
    const user = userEvent.setup()
    mockUseAnalytics.mockReturnValue(makeHookValue())
    render(<AnalyticsDashboard />)
    await waitFor(() => screen.getByRole('tab', { name: /^models$/i }))
    await user.click(screen.getByRole('tab', { name: /^models$/i }))
    await waitFor(() => expect(screen.getByText('N/A')).toBeInTheDocument())
  })

  it('shows loading state when analytics hook returns getMetrics=undefined', () => {
    mockUseAnalytics.mockReturnValue({ getMetrics: undefined, events: [], sessions: [], clearData: vi.fn() })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<AnalyticsDashboard />)
    // When getMetrics is absent, metrics state is never populated so loading screen persists
    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument()
  })

  describe('refresh interval + time range + auto-refresh timers', () => {
    it('changes the time range Select to "Last 7 days" and re-fetches metrics with a startDate', async () => {
      const getMetrics = vi.fn().mockResolvedValue(noopMetrics)
      mockUseAnalytics.mockReturnValue(makeHookValue({ getMetrics }))
      const user = userEvent.setup()
      render(<AnalyticsDashboard />)
      await waitFor(() => screen.getByRole('tab', { name: /^overview$/i }))
      const triggers = screen.getAllByRole('combobox')
      // combobox[0] = refresh-interval (disabled when paused), [1] = timeRange.
      await user.click(triggers[1])
      await user.click(await screen.findByRole('option', { name: /last 7 days/i }))
      await waitFor(() => {
        const sevenDayCall = getMetrics.mock.calls.find(([f]) =>
          f && typeof f.startDate === 'number',
        )
        expect(sevenDayCall).toBeTruthy()
      })
    })

    it('changes the time range Select to "Last 30 days" and re-fetches metrics', async () => {
      const getMetrics = vi.fn().mockResolvedValue(noopMetrics)
      mockUseAnalytics.mockReturnValue(makeHookValue({ getMetrics }))
      const user = userEvent.setup()
      render(<AnalyticsDashboard />)
      await waitFor(() => screen.getByRole('tab', { name: /^overview$/i }))
      const triggers = screen.getAllByRole('combobox')
      await user.click(triggers[1])
      await user.click(await screen.findByRole('option', { name: /last 30 days/i }))
      await waitFor(() => expect(getMetrics).toHaveBeenCalledTimes(2))
    })

    it('clicking Resume then Pause toggles the auto-refresh badge', async () => {
      mockUseAnalytics.mockReturnValue(makeHookValue())
      const user = userEvent.setup()
      render(<AnalyticsDashboard />)
      await waitFor(() => screen.getByRole('tab', { name: /^overview$/i }))
      expect(screen.getByText(/updates paused/i)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /resume/i }))
      await waitFor(() =>
        expect(screen.getByText(/next refresh in/i)).toBeInTheDocument(),
      )
      await user.click(screen.getByRole('button', { name: /pause/i }))
      await waitFor(() =>
        expect(screen.getByText(/updates paused/i)).toBeInTheDocument(),
      )
    })

    it('changes the refresh-interval Select after enabling auto-refresh', async () => {
      mockUseAnalytics.mockReturnValue(makeHookValue())
      const user = userEvent.setup()
      render(<AnalyticsDashboard />)
      await waitFor(() => screen.getByRole('tab', { name: /^overview$/i }))
      // Enable auto-refresh so the refresh-interval Select becomes enabled
      await user.click(screen.getByRole('button', { name: /resume/i }))
      const triggers = screen.getAllByRole('combobox')
      await user.click(triggers[0])
      await user.click(await screen.findByRole('option', { name: /^10s$/i }))
      // Verify badge updates with the new countdown value (initial 10 then ticks)
      await waitFor(() =>
        expect(screen.getByText(/next refresh in 10s|next refresh in 9s/i)).toBeInTheDocument(),
      )
    })

    it('mounts cleanly when initial events array contains a future-timestamped event (no crash from event-tracking effect)', async () => {
      const getMetrics = vi.fn().mockResolvedValue(noopMetrics)
      const futureEvent = {
        id: 'evt-new',
        action: 'noop',
        category: 'noop',
        timestamp: Date.now() + 10_000_000,
      }
      mockUseAnalytics.mockReturnValue(
        makeHookValue({ getMetrics, events: [futureEvent] }),
      )
      render(<AnalyticsDashboard />)
      await waitFor(() => expect(getMetrics).toHaveBeenCalled())
      // Both effects ran; component reached the data view.
      expect(screen.getByRole('tab', { name: /^overview$/i })).toBeInTheDocument()
    })

    it('Clear Data with clearData undefined surfaces toast.error (analytics not ready)', async () => {
      const user = userEvent.setup()
      const { toast } = await import('sonner')
      mockUseAnalytics.mockReturnValue(makeHookValue({ clearData: undefined }))
      render(<AnalyticsDashboard />)
      await waitFor(() => screen.getByRole('button', { name: /clear data/i }))
      await user.click(screen.getByRole('button', { name: /clear data/i }))
      expect(toast.error).toHaveBeenCalledWith('Analytics not ready')
    })

    it('Overview Top Actions list renders entries from metrics.topActions', async () => {
      const metrics = {
        ...noopMetrics,
        topActions: [{ action: 'click_btn', count: 7 }, { action: 'view_page', count: 3 }],
      }
      mockUseAnalytics.mockReturnValue(makeHookValue({
        getMetrics: vi.fn().mockResolvedValue(metrics),
      }))
      render(<AnalyticsDashboard />)
      await waitFor(() => expect(screen.getByText('click_btn')).toBeInTheDocument())
      expect(screen.getByText('view_page')).toBeInTheDocument()
    })

    it('Agents tab Most Used Tools list renders entries from metrics.agentMetrics.mostUsedTools', async () => {
      const user = userEvent.setup()
      const metrics = {
        ...noopMetrics,
        agentMetrics: {
          ...noopMetrics.agentMetrics,
          mostUsedTools: [{ tool: 'shell', count: 5 }, { tool: 'edit', count: 2 }],
          successRate: 95,
        },
      }
      mockUseAnalytics.mockReturnValue(makeHookValue({
        getMetrics: vi.fn().mockResolvedValue(metrics),
      }))
      render(<AnalyticsDashboard />)
      await waitFor(() => screen.getByRole('tab', { name: /^agents$/i }))
      await user.click(screen.getByRole('tab', { name: /^agents$/i }))
      expect(await screen.findByText('shell')).toBeInTheDocument()
      expect(screen.getByText('edit')).toBeInTheDocument()
    })

    it('Models tab Most Popular Models list renders entries from metrics.modelMetrics.mostPopularModels', async () => {
      const user = userEvent.setup()
      const metrics = {
        ...noopMetrics,
        modelMetrics: {
          ...noopMetrics.modelMetrics,
          mostPopularModels: [{ model: 'llama-3', downloads: 99 }, { model: 'gemma-2', downloads: 12 }],
        },
      }
      mockUseAnalytics.mockReturnValue(makeHookValue({
        getMetrics: vi.fn().mockResolvedValue(metrics),
      }))
      render(<AnalyticsDashboard />)
      await waitFor(() => screen.getByRole('tab', { name: /^models$/i }))
      await user.click(screen.getByRole('tab', { name: /^models$/i }))
      expect((await screen.findAllByText('llama-3')).length).toBeGreaterThan(0)
      expect(screen.getAllByText('gemma-2').length).toBeGreaterThan(0)
    })
  })
})
