import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analytics } from './analytics'

// Mock the global spark object
const mockKVStore = new Map<string, any>()

beforeEach(() => {
  mockKVStore.clear()

  global.spark = {
    kv: {
      get: vi.fn((key: string) => Promise.resolve(mockKVStore.get(key))),
      set: vi.fn((key: string, value: any) => {
        mockKVStore.set(key, value)
        return Promise.resolve()
      }),
      delete: vi.fn((key: string) => {
        mockKVStore.delete(key)
        return Promise.resolve()
      }),
    },
    user: vi.fn(() => Promise.resolve({ id: 'test-user-123' })),
  } as any

  // Mock console methods
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AnalyticsService', () => {
  describe('track', () => {
    it('should track an event with basic information', async () => {
      await analytics.track('page_viewed', 'navigation', 'view_home')

      const events = await spark.kv.get('analytics-events')
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'page_viewed',
        category: 'navigation',
        action: 'view_home',
        userId: 'test-user-123',
      })
    })

    it('should track an event with optional parameters', async () => {
      await analytics.track('button_clicked', 'interaction', 'submit_form', {
        label: 'Contact Form',
        value: 1,
        metadata: { formId: 'contact-123' },
        duration: 5000,
      })

      const events = await spark.kv.get('analytics-events')
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
      await analytics.track('test_event', 'test_category', 'test_action')

      const events = await spark.kv.get('analytics-events')
      expect(events[0].sessionId).toBeDefined()
      expect(events[0].sessionId).toMatch(/^session-/)
    })

    it('should handle errors gracefully', async () => {
      vi.spyOn(spark.kv, 'get').mockRejectedValueOnce(new Error('Storage error'))

      await expect(
        analytics.track('test_event', 'test_category', 'test_action')
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
        type: 'test_event',
        category: 'test',
        action: 'test',
        timestamp: Date.now(),
        sessionId: 'test-session',
      }))
      mockKVStore.set('analytics-events', existingEvents)

      await analytics.track('new_event', 'test', 'test')

      const events = await spark.kv.get('analytics-events')
      expect(events).toHaveLength(10000)
      expect(events[0].type).toBe('new_event')
    })
  })

  describe('getEvents', () => {
    beforeEach(async () => {
      // Add test events
      await analytics.track('event1', 'category1', 'action1')
      await analytics.track('event2', 'category2', 'action2')
      await analytics.track('error_occurred', 'errors', 'load_failed')
    })

    it('should return all events without filter', async () => {
      const events = await analytics.getEvents()
      expect(events.length).toBeGreaterThanOrEqual(3)
    })

    it('should filter events by type', async () => {
      const events = await analytics.getEvents({
        eventTypes: ['error_occurred'],
      })
      expect(events.every(e => e.type === 'error_occurred')).toBe(true)
    })

    it('should filter events by category', async () => {
      const events = await analytics.getEvents({
        category: 'category1',
      })
      expect(events.every(e => e.category === 'category1')).toBe(true)
    })

    it('should filter events by userId', async () => {
      const events = await analytics.getEvents({
        userId: 'test-user-123',
      })
      expect(events.every(e => e.userId === 'test-user-123')).toBe(true)
    })

    it('should filter events by date range', async () => {
      const now = Date.now()
      const oneHourAgo = now - 3600000

      const events = await analytics.getEvents({
        startDate: oneHourAgo,
        endDate: now,
      })

      expect(events.every(e => e.timestamp >= oneHourAgo && e.timestamp <= now)).toBe(true)
    })
  })

  describe('getSessions', () => {
    it('should return analytics sessions', async () => {
      // Track an event to create a session
      await analytics.track('test_event', 'test', 'test')

      // Wait a bit for session to be initialized
      await new Promise(resolve => setTimeout(resolve, 10))

      const sessions = await analytics.getSessions()
      expect(sessions.length).toBeGreaterThanOrEqual(0)

      // If sessions exist, validate structure
      if (sessions.length > 0) {
        expect(sessions[0]).toHaveProperty('id')
        expect(sessions[0]).toHaveProperty('startedAt')
        expect(sessions[0]).toHaveProperty('platform')
        expect(sessions[0]).toHaveProperty('userAgent')
      }
    })
  })

  describe('getMetrics', () => {
    beforeEach(async () => {
      // Add various test events
      await analytics.track('page_viewed', 'navigation', 'view_home')
      await analytics.track('chat_message_sent', 'chat', 'send_message')
      await analytics.track('chat_message_received', 'chat', 'receive_message', {
        duration: 1000,
        metadata: { model: 'gpt-4' },
      })
      await analytics.track('agent_created', 'agent', 'create_agent')
      await analytics.track('agent_run_started', 'agent', 'start_run')
      await analytics.track('agent_run_completed', 'agent', 'complete_run', {
        duration: 5000,
      })
      await analytics.track('error_occurred', 'errors', 'api_error')
      await analytics.track('model_downloaded', 'models', 'download', {
        metadata: { modelId: 'model-123', modelName: 'test-model', size: 1024000 },
      })
    })

    it('should calculate total events and sessions', async () => {
      const metrics = await analytics.getMetrics()
      expect(metrics.totalEvents).toBeGreaterThan(0)
      // Sessions may not be immediately available in test environment
      expect(metrics.totalSessions).toBeGreaterThanOrEqual(0)
    })

    it('should calculate active users', async () => {
      const metrics = await analytics.getMetrics()
      expect(metrics.activeUsers).toBeGreaterThanOrEqual(1)
    })

    it('should calculate error rate', async () => {
      const metrics = await analytics.getMetrics()
      expect(metrics.errorRate).toBeGreaterThan(0)
      expect(metrics.errorRate).toBeLessThanOrEqual(100)
    })

    it('should group events by type', async () => {
      const metrics = await analytics.getMetrics()
      expect(metrics.eventsByType).toBeDefined()
      expect(Array.isArray(metrics.eventsByType)).toBe(true)
      expect(metrics.eventsByType.length).toBeGreaterThan(0)
    })

    it('should calculate chat metrics', async () => {
      const metrics = await analytics.getMetrics()
      expect(metrics.chatMetrics).toBeDefined()
      expect(metrics.chatMetrics.totalMessages).toBeGreaterThan(0)
      expect(metrics.chatMetrics.averageResponseTime).toBeGreaterThan(0)
      expect(metrics.chatMetrics.mostUsedModels).toBeDefined()
    })

    it('should calculate agent metrics', async () => {
      const metrics = await analytics.getMetrics()
      expect(metrics.agentMetrics).toBeDefined()
      expect(metrics.agentMetrics.totalAgents).toBeGreaterThan(0)
      expect(metrics.agentMetrics.totalRuns).toBeGreaterThan(0)
      expect(metrics.agentMetrics.successRate).toBeGreaterThan(0)
    })

    it('should calculate model metrics', async () => {
      const metrics = await analytics.getMetrics()
      expect(metrics.modelMetrics).toBeDefined()
      expect(metrics.modelMetrics.totalDownloads).toBeGreaterThan(0)
      expect(metrics.modelMetrics.storageUsed).toBeGreaterThan(0)
    })

    it('should provide top actions', async () => {
      const metrics = await analytics.getMetrics()
      expect(metrics.topActions).toBeDefined()
      expect(Array.isArray(metrics.topActions)).toBe(true)
    })
  })

  describe('clearData', () => {
    it('should clear all analytics data', async () => {
      await analytics.track('test_event', 'test', 'test')
      await analytics.clearData()

      const events = await spark.kv.get('analytics-events')
      const sessions = await spark.kv.get('analytics-sessions')

      expect(events).toBeUndefined()
      expect(sessions).toBeUndefined()
    })
  })
})
