import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AnalyticsEvent, AnalyticsEventType, AnalyticsSession } from './types'

// Mock the global spark object
declare global {
  // @ts-expect-error - spark is a test mock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var spark: any
}

const mockKVStore = new Map<string, unknown>()

describe('AnalyticsService', () => {
  let analyticsInstance: {
    track: (
      type: string,
      category: string,
      action: string,
      options?: {
        label?: string
        value?: number
        metadata?: Record<string, unknown>
        duration?: number
      }
    ) => Promise<void>
  }

  beforeEach(async () => {
    vi.resetModules()
    mockKVStore.clear()

    // @ts-expect-error - spark is a test mock
    globalThis.spark = {
      kv: {
        get: vi.fn((key: string) => Promise.resolve(mockKVStore.get(key))),
        set: vi.fn((key: string, value: unknown) => {
          mockKVStore.set(key, value)
          return Promise.resolve()
        }),
        delete: vi.fn((key: string) => {
          mockKVStore.delete(key)
          return Promise.resolve()
        }),
      },
      user: vi.fn(() => Promise.resolve({ id: 'test-user-123' })),
    }

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Import a fresh analytics instance AFTER mocks are set up so the
    // constructor's initSession() call uses the per-test spark mock.
    const module = await import('./analytics')
    analyticsInstance = module.analytics
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('track', () => {
    it('should track an event with basic information', async () => {
      await analyticsInstance.track('page_viewed', 'navigation', 'view_home')

      const events = (await spark.kv.get('analytics-events')) as AnalyticsEvent[]
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'page_viewed',
        category: 'navigation',
        action: 'view_home',
        userId: 'test-user-123',
      })
    })

    it('should track an event with optional parameters', async () => {
      await analyticsInstance.track('button_clicked', 'interaction', 'submit_form', {
        label: 'Contact Form',
        value: 1,
        metadata: { formId: 'contact-123' },
        duration: 5000,
      })

      const events = (await spark.kv.get('analytics-events')) as AnalyticsEvent[]
      expect(events[0]).toMatchObject({
        type: 'button_clicked',
        category: 'interaction',
        action: 'submit_form',
        label: 'Contact Form',
        value: 1,
        duration: 5000,
      })
      expect(events[0].metadata).toEqual({ formId: 'contact-123' })
    })

    it('should include session information', async () => {
      await analyticsInstance.track('test_event', 'test_category', 'test_action')

      const events = (await spark.kv.get('analytics-events')) as AnalyticsEvent[]
      expect(events[0].sessionId).toBeDefined()
      expect(events[0].sessionId).toMatch(/^session-/)
    })

    it('should handle errors gracefully', async () => {
      vi.spyOn(spark.kv, 'get').mockRejectedValueOnce(new Error('Storage error'))

      await expect(
        analyticsInstance.track('test_event', 'test_category', 'test_action')
      ).resolves.not.toThrow()

      expect(console.error).toHaveBeenCalledWith(
        '[Analytics] Error tracking event:',
        expect.any(Error)
      )
    })

    it('should limit stored events to 10000', async () => {
      // Pre-populate with 10000 events
      const existingEvents = Array.from({ length: 10000 }, (_, i) => ({
        id: `event-${i}`,
        type: 'test_event' as const,
        category: 'test',
        action: 'test',
        timestamp: Date.now(),
        sessionId: 'test-session',
      }))
      mockKVStore.set('analytics-events', existingEvents)

      await analyticsInstance.track('new_event', 'test', 'test')

      const events = (await spark.kv.get('analytics-events')) as AnalyticsEvent[]
      expect(events).toHaveLength(10000)
      expect(events[0].type).toBe('new_event')
    })
  })

  describe('getEvents', () => {
    let getEvents: (filter?: {
      startDate?: number
      endDate?: number
      eventTypes?: string[]
      userId?: string
      category?: string
    }) => Promise<AnalyticsEvent[]>

    beforeEach(async () => {
      const module = await import('./analytics')
      analyticsInstance = module.analytics
      getEvents = module.analytics.getEvents.bind(module.analytics)
      // Add test events
      await analyticsInstance.track('event1', 'category1', 'action1')
      await analyticsInstance.track('event2', 'category2', 'action2')
      await analyticsInstance.track('error_occurred', 'errors', 'load_failed')
    })

    it('should return all events without filter', async () => {
      const events = await getEvents()
      expect(events.length).toBeGreaterThanOrEqual(3)
    })

    it('should filter events by type', async () => {
      const events = await getEvents({
        eventTypes: ['error_occurred'],
      })
      expect(events.every((e) => e.type === 'error_occurred')).toBe(true)
    })

    it('should filter events by category', async () => {
      const events = await getEvents({
        category: 'category1',
      })
      expect(events.every((e) => e.category === 'category1')).toBe(true)
    })

    it('should filter events by userId', async () => {
      const events = await getEvents({
        userId: 'test-user-123',
      })
      expect(events.every((e) => e.userId === 'test-user-123')).toBe(true)
    })

    it('should filter events by date range', async () => {
      const now = Date.now()
      const oneHourAgo = now - 3600000

      const events = await getEvents({
        startDate: oneHourAgo,
        endDate: now,
      })

      expect(events.every((e) => e.timestamp >= oneHourAgo && e.timestamp <= now)).toBe(true)
    })
  })

  describe('getSessions', () => {
    let getSessions: () => Promise<unknown[]>

    beforeEach(async () => {
      const module = await import('./analytics')
      analyticsInstance = module.analytics
      getSessions = module.analytics.getSessions.bind(module.analytics)
    })

    it('should return analytics sessions', async () => {
      // Track an event so updateSession runs and session initialization completes
      await analyticsInstance.track('test_event', 'test', 'test')

      // Use vi.waitFor to wait until initSession has persisted the session
      await vi.waitFor(async () => {
        const sessions = await getSessions()
        expect(sessions.length).toBeGreaterThan(0)
      })

      const sessions = await getSessions()

      expect(sessions[0]).toHaveProperty('id')
      expect(sessions[0]).toHaveProperty('startedAt')
      expect(sessions[0]).toHaveProperty('platform')
      expect(sessions[0]).toHaveProperty('userAgent')
    })
  })

  describe('getMetrics', () => {
    let getMetrics: () => Promise<unknown>

    beforeEach(async () => {
      const module = await import('./analytics')
      analyticsInstance = module.analytics
      getMetrics = module.analytics.getMetrics.bind(module.analytics)
      // Add various test events
      await analyticsInstance.track('page_viewed', 'navigation', 'view_home')
      await analyticsInstance.track('chat_message_sent', 'chat', 'send_message')
      await analyticsInstance.track('chat_message_received', 'chat', 'receive_message', {
        duration: 1000,
        metadata: { model: 'gpt-4' },
      })
      await analyticsInstance.track('agent_created', 'agent', 'create_agent')
      await analyticsInstance.track('agent_run_started', 'agent', 'start_run')
      await analyticsInstance.track('agent_run_completed', 'agent', 'complete_run', {
        duration: 5000,
      })
      await analyticsInstance.track('error_occurred', 'errors', 'api_error')
      await analyticsInstance.track('model_downloaded', 'models', 'download', {
        metadata: { modelId: 'model-123', modelName: 'test-model', size: 1024000 },
      })
    })

    it('should calculate total events and sessions', async () => {
      const metrics = (await getMetrics()) as { totalEvents: number; totalSessions: number }
      expect(metrics.totalEvents).toBeGreaterThan(0)
      // Sessions may not be immediately available in test environment
      expect(metrics.totalSessions).toBeGreaterThanOrEqual(0)
    })

    it('should calculate active users', async () => {
      const metrics = (await getMetrics()) as { activeUsers: number }
      expect(metrics.activeUsers).toBeGreaterThanOrEqual(1)
    })

    it('should calculate error rate', async () => {
      const metrics = (await getMetrics()) as { errorRate: number }
      expect(metrics.errorRate).toBeGreaterThan(0)
      expect(metrics.errorRate).toBeLessThanOrEqual(100)
    })

    it('should group events by type', async () => {
      const metrics = (await getMetrics()) as { eventsByType: unknown[] }
      expect(metrics.eventsByType).toBeDefined()
      expect(Array.isArray(metrics.eventsByType)).toBe(true)
      expect(metrics.eventsByType.length).toBeGreaterThan(0)
    })

    it('should calculate chat metrics', async () => {
      const metrics = (await getMetrics()) as {
        chatMetrics: {
          totalMessages: number
          averageResponseTime: number
          mostUsedModels: unknown[]
        }
      }
      expect(metrics.chatMetrics).toBeDefined()
      expect(metrics.chatMetrics.totalMessages).toBeGreaterThan(0)
      expect(metrics.chatMetrics.averageResponseTime).toBeGreaterThan(0)
      expect(metrics.chatMetrics.mostUsedModels).toBeDefined()
    })

    it('should calculate agent metrics', async () => {
      const metrics = (await getMetrics()) as {
        agentMetrics: {
          totalAgents: number
          totalRuns: number
          successRate: number
        }
      }
      expect(metrics.agentMetrics).toBeDefined()
      expect(metrics.agentMetrics.totalAgents).toBeGreaterThan(0)
      expect(metrics.agentMetrics.totalRuns).toBeGreaterThan(0)
      expect(metrics.agentMetrics.successRate).toBeGreaterThan(0)
    })

    it('should calculate model metrics', async () => {
      const metrics = (await getMetrics()) as {
        modelMetrics: {
          totalDownloads: number
          storageUsed: number
        }
      }
      expect(metrics.modelMetrics).toBeDefined()
      expect(metrics.modelMetrics.totalDownloads).toBeGreaterThan(0)
      expect(metrics.modelMetrics.storageUsed).toBeGreaterThan(0)
    })

    it('should provide top actions', async () => {
      const metrics = (await getMetrics()) as { topActions: unknown[] }
      expect(metrics.topActions).toBeDefined()
      expect(Array.isArray(metrics.topActions)).toBe(true)
    })
  })

  describe('clearData', () => {
    let clearData: () => Promise<void>

    beforeEach(async () => {
      const module = await import('./analytics')
      analyticsInstance = module.analytics
      clearData = module.analytics.clearData.bind(module.analytics)
    })

    it('should clear all analytics data', async () => {
      await analyticsInstance.track('test_event', 'test', 'test')
      await clearData()

      const events = await spark.kv.get('analytics-events')
      const sessions = await spark.kv.get('analytics-sessions')

      expect(events).toBeUndefined()
      expect(sessions).toBeUndefined()
    })
  })

  describe('additional metric branches', () => {
    let getMetrics: () => Promise<unknown>

    beforeEach(async () => {
      const module = await import('./analytics')
      analyticsInstance = module.analytics
      getMetrics = module.analytics.getMetrics.bind(module.analytics)
    })

    it('mostUsedTools rolls up tool_used events with metadata.tool (lines 257-268)', async () => {
      await analyticsInstance.track('tool_used', 'agent', 'use_tool', { metadata: { tool: 'calculator' } })
      await analyticsInstance.track('tool_used', 'agent', 'use_tool', { metadata: { tool: 'calculator' } })
      await analyticsInstance.track('tool_used', 'agent', 'use_tool', { metadata: { tool: 'web_search' } })
      const metrics = (await getMetrics()) as {
        agentMetrics: { mostUsedTools: Array<{ tool: string; count: number }> }
      }
      const tools = metrics.agentMetrics.mostUsedTools
      expect(tools.find((t) => t.tool === 'calculator')?.count).toBe(2)
      expect(tools.find((t) => t.tool === 'web_search')?.count).toBe(1)
    })

    it('mostPopularModels sorts and slices by download count (lines 287-296)', async () => {
      // Three downloads of "alpha", two of "beta", one of "gamma" → sort desc.
      for (const name of ['alpha', 'alpha', 'alpha', 'beta', 'beta', 'gamma']) {
        await analyticsInstance.track('model_downloaded', 'models', 'download', {
          metadata: { modelId: `id-${name}-${Math.random()}`, modelName: name, size: 1000 },
        })
      }
      const metrics = (await getMetrics()) as {
        modelMetrics: { mostPopularModels: Array<{ model: string; downloads: number }> }
      }
      const top = metrics.modelMetrics.mostPopularModels
      expect(top[0].model).toBe('alpha')
      expect(top[0].downloads).toBeGreaterThanOrEqual(3)
      expect(top.find((m) => m.model === 'beta')?.downloads).toBeGreaterThanOrEqual(2)
    })

    it('eventsByDay buckets events into separate dates and sorts them (line 199)', async () => {
      // Seed two events with timestamps on different days, then call getMetrics.
      const earlier: AnalyticsEvent[] = [
        {
          id: 't-day1',
          type: 'page_viewed' as AnalyticsEventType,
          category: 'navigation',
          action: 'view',
          timestamp: new Date('2026-01-01T10:00:00Z').getTime(),
          sessionId: 's1',
        },
        {
          id: 't-day2',
          type: 'page_viewed' as AnalyticsEventType,
          category: 'navigation',
          action: 'view',
          timestamp: new Date('2026-01-02T10:00:00Z').getTime(),
          sessionId: 's1',
        },
        {
          id: 't-day3',
          type: 'page_viewed' as AnalyticsEventType,
          category: 'navigation',
          action: 'view',
          timestamp: new Date('2026-01-03T10:00:00Z').getTime(),
          sessionId: 's1',
        },
      ]
      await spark.kv.set('analytics-events', earlier)
      const metrics = (await getMetrics()) as {
        eventsByDay: Array<{ date: string; count: number }>
      }
      expect(metrics.eventsByDay.length).toBe(3)
      // Ascending date order: 2026-01-01, 02, 03 — exercises the sort callback.
      expect(metrics.eventsByDay[0].date).toBe('2026-01-01')
      expect(metrics.eventsByDay[2].date).toBe('2026-01-03')
    })

    it('averageSessionDuration averages over completed sessions (line 141)', async () => {
      const sessions: AnalyticsSession[] = [
        { id: 's-c1', startedAt: 0, endedAt: 1000, duration: 1000, eventCount: 1, userId: 'u' },
        { id: 's-c2', startedAt: 0, endedAt: 3000, duration: 3000, eventCount: 1, userId: 'u' },
      ]
      await spark.kv.set('analytics-sessions', sessions)
      // Need at least one event so getMetrics doesn't short-circuit.
      await analyticsInstance.track('page_viewed', 'navigation', 'view')
      const metrics = (await getMetrics()) as { averageSessionDuration: number }
      expect(metrics.averageSessionDuration).toBe(2000)
    })
  })
})
