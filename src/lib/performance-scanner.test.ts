import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Mock hardware-scanner so performance-scanner tests don't depend on the
 * real HardwareSpecs structure. spark.kv is already stubbed in
 * src/test/setup.ts (set/get are vi.fn()).
 */
vi.mock('./hardware-scanner', () => ({
  scanHardware: vi.fn(async () => ({
    hardwareConcurrency: 4,
    maxTouchPoints: 0,
    platform: 'Linux',
    userAgent: 'jsdom',
    screen: { width: 1280, height: 720, pixelRatio: 1, colorDepth: 24 },
    performanceScore: 200,
    tier: 'medium' as const,
    connection: { effectiveType: '4g', downlink: 10, rtt: 100, saveData: false },
    battery: { level: 0.5, charging: true },
  })),
}))

import { PerformanceScanner, performanceScanner } from './performance-scanner'
import { scanHardware } from './hardware-scanner'
import type { AnalyticsEvent, ModelConfig } from './types'

const evt = (overrides: Partial<AnalyticsEvent>): AnalyticsEvent => ({
  id: `e-${Math.random()}`,
  type: 'chat_message_sent',
  timestamp: 1700000000000,
  sessionId: 's',
  category: 'chat',
  action: 'a',
  ...overrides,
})

const model: ModelConfig = {
  id: 'm1',
  name: 'M1',
  provider: 'ollama',
  temperature: 0.7,
  maxTokens: 4000,
  topP: 0.9,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1,
}

describe('PerformanceScanner.performComprehensiveScan', () => {
  beforeEach(() => {
    // Reset spark.kv mock state.
    // @ts-expect-error - spark mock
    globalThis.spark.kv.set.mockClear?.()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('produces a structured scan result and persists scan history to spark.kv', async () => {
    const scanner = new PerformanceScanner()
    const events: AnalyticsEvent[] = []
    for (let i = 0; i < 5; i++) {
      events.push(
        evt({
          type: 'chat_message_received',
          duration: 1500,
          metadata: { model: 'm1', responseLength: 200 },
        }),
      )
    }
    const result = await scanner.performComprehensiveScan(events, [model], [])
    expect(result.id).toMatch(/^scan-/)
    expect(result.hardwareSpecs.tier).toBe('medium')
    expect(result.currentMetrics.avgResponseTime).toBe(1500)
    expect(result.currentMetrics.successRate).toBe(100)
    expect(Array.isArray(result.optimizations)).toBe(true)
    // @ts-expect-error spark mock
    expect(globalThis.spark.kv.set).toHaveBeenCalledWith(
      'performance-scan-history',
      expect.any(Array),
    )
  })

  it('returns zero metrics when no chat events are present', async () => {
    const scanner = new PerformanceScanner()
    const result = await scanner.performComprehensiveScan([], [], [])
    expect(result.currentMetrics.avgResponseTime).toBe(0)
    expect(result.currentMetrics.successRate).toBe(100)
  })

  it('rejects when a scan is already in progress', async () => {
    const scanner = new PerformanceScanner()
    // Cause the first scan to hang so isScanning stays true.
    let resolveFn: (() => void) | undefined
    ;(scanHardware as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise<ReturnType<typeof scanHardware>>(res => {
        resolveFn = () => res(undefined as unknown as ReturnType<typeof scanHardware>)
      }),
    )
    const first = scanner.performComprehensiveScan([], [], [])
    await expect(scanner.performComprehensiveScan([], [], [])).rejects.toThrow('already in progress')
    resolveFn?.()
    // The first scan rejects because scanHardware resolved with `undefined`,
    // so swallow the error here.
    await first.catch(() => {})
  })

  it('flags critical bottlenecks for very high p99 response time', async () => {
    const scanner = new PerformanceScanner()
    const events: AnalyticsEvent[] = []
    for (let i = 0; i < 50; i++) {
      events.push(
        evt({
          type: 'chat_message_received',
          duration: 20_000,
          metadata: { model: 'm1', responseLength: 200 },
        }),
      )
    }
    const result = await scanner.performComprehensiveScan(events, [model], [])
    const types = result.bottlenecks.map(b => b.severity)
    expect(types).toContain('critical')
  })

  it('flags wasted-tokens bottleneck when avg responseLength « maxTokens', async () => {
    const scanner = new PerformanceScanner()
    const events: AnalyticsEvent[] = []
    for (let i = 0; i < 10; i++) {
      events.push(
        evt({
          type: 'chat_message_received',
          duration: 1000,
          metadata: { model: 'm1', responseLength: 50 },
        }),
      )
    }
    const result = await scanner.performComprehensiveScan(events, [model], [])
    expect(result.currentMetrics.modelEfficiency.m1.wastedTokens).toBeGreaterThan(0)
    expect(result.bottlenecks.find(b => b.type === 'parameter')).toBeDefined()
  })
})

describe('PerformanceScanner.applyOptimizations', () => {
  it('reduces maxTokens by the configured percentage', async () => {
    const scanner = new PerformanceScanner()
    const out = await scanner.applyOptimizations(
      [
        {
          id: 'o1',
          type: 'change_model_config',
          priority: 'high',
          description: '',
          changes: { reduceMaxTokensByPercent: 50, lowerTemperatureForSpeed: true },
          expectedGain: '',
          confidence: 0.9,
          autoApplicable: true,
        },
      ],
      [model],
    )
    expect(out.applied).toBe(1)
    expect(out.updated[0].maxTokens).toBe(2000)
    expect(out.updated[0].temperature).toBeCloseTo(0.56)
  })

  it('applies optimize_tokens to the targeted model only', async () => {
    const scanner = new PerformanceScanner()
    const m2: ModelConfig = { ...model, id: 'm2' }
    const out = await scanner.applyOptimizations(
      [
        {
          id: 'o1',
          type: 'optimize_tokens',
          priority: 'medium',
          description: '',
          targetModel: 'm1',
          changes: { maxTokens: 1500 },
          expectedGain: '',
          confidence: 0.9,
          autoApplicable: true,
        },
      ],
      [model, m2],
    )
    expect(out.updated.find(m => m.id === 'm1')!.maxTokens).toBe(1500)
    expect(out.updated.find(m => m.id === 'm2')!.maxTokens).toBe(4000)
  })

  it('skips optimizations marked autoApplicable=false', async () => {
    const scanner = new PerformanceScanner()
    const out = await scanner.applyOptimizations(
      [
        {
          id: 'o1',
          type: 'enable_caching',
          priority: 'low',
          description: '',
          changes: {},
          expectedGain: '',
          confidence: 0.7,
          autoApplicable: false,
        },
      ],
      [model],
    )
    expect(out.applied).toBe(0)
  })
})

describe('PerformanceScanner history', () => {
  it('exposes a singleton and getScanHistory clones the internal array', () => {
    expect(performanceScanner).toBeInstanceOf(PerformanceScanner)
    const scanner = new PerformanceScanner()
    const initial = scanner.getScanHistory()
    expect(Array.isArray(initial)).toBe(true)
    initial.push({ id: 'fake' } as never)
    expect(scanner.getScanHistory()).toHaveLength(0)
  })

  it('loadScanHistory pulls from spark.kv.get', async () => {
    // @ts-expect-error spark mock
    globalThis.spark.kv.get.mockResolvedValueOnce([{ id: 'scan-1' }])
    const scanner = new PerformanceScanner()
    await scanner.loadScanHistory()
    expect(scanner.getScanHistory()).toEqual([{ id: 'scan-1' }])
  })

  it('caps scanHistory at 20 entries (ring-buffer slice)', async () => {
    const scanner = new PerformanceScanner()
    for (let i = 0; i < 21; i++) {
      await scanner.performComprehensiveScan([], [], [])
    }
    expect(scanner.getScanHistory()).toHaveLength(20)
  })
})

describe('PerformanceScanner edge branches', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips models that have zero chat events (modelEfficiency entry omitted)', async () => {
    const scanner = new PerformanceScanner()
    const m2: ModelConfig = { ...model, id: 'm2', name: 'M2' }
    const events: AnalyticsEvent[] = [
      evt({
        type: 'chat_message_received',
        duration: 1000,
        metadata: { model: 'm1', responseLength: 200 },
      }),
    ]
    const result = await scanner.performComprehensiveScan(events, [model, m2], [])
    expect(result.currentMetrics.modelEfficiency.m1).toBeDefined()
    expect(result.currentMetrics.modelEfficiency.m2).toBeUndefined()
  })

  it('flags hardware/network/error/battery bottlenecks under low-tier conditions', async () => {
    ;(scanHardware as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      hardwareConcurrency: 2,
      maxTouchPoints: 0,
      platform: 'Linux',
      userAgent: 'jsdom',
      screen: { width: 800, height: 600, pixelRatio: 1, colorDepth: 24 },
      performanceScore: 50,
      tier: 'low' as const,
      connection: { effectiveType: '2g', downlink: 0.1, rtt: 600, saveData: true },
      battery: { level: 0.05, charging: false },
    })
    const scanner = new PerformanceScanner()
    const events: AnalyticsEvent[] = []
    for (let i = 0; i < 20; i++) {
      events.push(
        evt({
          type: 'chat_message_received',
          duration: 9000,
          metadata: { model: 'm1', responseLength: 50 },
        }),
      )
    }
    for (let i = 0; i < 5; i++) {
      events.push(
        evt({ type: 'error_occurred', metadata: { model: 'm1' } }),
      )
    }
    const result = await scanner.performComprehensiveScan(events, [model], [])
    const types = new Set(result.bottlenecks.map(b => b.type))
    expect(types.has('hardware')).toBe(true)
    expect(types.has('network')).toBe(true)
    expect(result.bottlenecks.some(b => b.type === 'model_config' && b.description.includes('error rate'))).toBe(true)
    expect(result.bottlenecks.some(b => b.description.toLowerCase().includes('battery'))).toBe(true)
    const optTypes = new Set(result.optimizations.map(o => o.type))
    expect(optTypes.has('hardware_tuning')).toBe(true)
    expect(optTypes.has('reduce_load')).toBe(true)
    expect(result.estimatedImprovements.responseTimeReduction).toBeGreaterThan(0)
  })

  it('flags low-throughput model bottleneck when tokensPerSecond < 10', async () => {
    const scanner = new PerformanceScanner()
    const events: AnalyticsEvent[] = []
    for (let i = 0; i < 10; i++) {
      events.push(
        evt({
          type: 'chat_message_received',
          duration: 10_000,
          metadata: { model: 'm1', responseLength: 5 },
        }),
      )
    }
    const result = await scanner.performComprehensiveScan(events, [model], [])
    expect(result.currentMetrics.modelEfficiency.m1.tokensPerSecond).toBeLessThan(10)
    expect(
      result.bottlenecks.some(b => b.type === 'model_config' && b.description.includes('throughput')),
    ).toBe(true)
  })

  it('emits a general fallback optimization when p95 > 5000 and nothing else fires', async () => {
    const scanner = new PerformanceScanner()
    const events: AnalyticsEvent[] = []
    // 9 fast + 1 slow with n=10 → p95 index = ceil(9.5)-1 = 9 → the slow sample.
    // responseLength tuned so wastedTokens stays < 1000 (avoids parameter bottleneck).
    for (let i = 0; i < 9; i++) {
      events.push(
        evt({
          type: 'chat_message_received',
          duration: 1500,
          metadata: { model: 'm1', responseLength: 3500 },
        }),
      )
    }
    events.push(
      evt({
        type: 'chat_message_received',
        duration: 6000,
        metadata: { model: 'm1', responseLength: 3500 },
      }),
    )
    const result = await scanner.performComprehensiveScan(events, [model], [])
    expect(result.currentMetrics.p95ResponseTime).toBeGreaterThan(5000)
    expect(result.currentMetrics.p95ResponseTime).toBeLessThanOrEqual(8000)
    expect(result.optimizations.some(o => o.description.includes('general performance'))).toBe(true)
  })

  it('penalises high-temp/low-freq-penalty parameter combos and suggests freqPenalty bump', async () => {
    const scanner = new PerformanceScanner()
    const hotModel: ModelConfig = {
      ...model,
      id: 'hot',
      temperature: 0.95,
      frequencyPenalty: 0.1,
      maxTokens: 4000,
    }
    const events: AnalyticsEvent[] = []
    for (let i = 0; i < 10; i++) {
      events.push(
        evt({
          type: 'chat_message_received',
          duration: 1000,
          metadata: { model: 'hot', responseLength: 50 },
        }),
      )
    }
    const result = await scanner.performComprehensiveScan(events, [hotModel], [])
    expect(result.currentMetrics.modelEfficiency.hot.parameterEfficiency).toBeLessThan(70)
    const paramOpt = result.optimizations.find(
      o => o.type === 'adjust_parameter' && o.targetModel === 'hot',
    )
    expect(paramOpt).toBeDefined()
    expect(paramOpt!.changes.frequencyPenalty).toBe(0.4)
  })

  it('penalises low-temp/high-topP combos and suggests topP reduction', async () => {
    const scanner = new PerformanceScanner()
    const coldModel: ModelConfig = {
      ...model,
      id: 'cold',
      temperature: 0.1,
      topP: 0.97,
      frequencyPenalty: 0.1,
      maxTokens: 4000,
    }
    const events: AnalyticsEvent[] = []
    for (let i = 0; i < 10; i++) {
      events.push(
        evt({
          type: 'chat_message_received',
          duration: 1000,
          metadata: { model: 'cold', responseLength: 50 },
        }),
      )
    }
    const result = await scanner.performComprehensiveScan(events, [coldModel], [])
    expect(result.currentMetrics.modelEfficiency.cold.parameterEfficiency).toBeLessThan(70)
    const paramOpt = result.optimizations.find(
      o => o.type === 'adjust_parameter' && o.targetModel === 'cold',
    )
    expect(paramOpt).toBeDefined()
    expect(paramOpt!.changes.topP).toBe(0.88)
  })
})

describe('PerformanceScanner.applyOptimizations more types', () => {
  it('applies hardware_tuning by clamping maxTokens to the configured cap', async () => {
    const scanner = new PerformanceScanner()
    const out = await scanner.applyOptimizations(
      [
        {
          id: 'o-ht',
          type: 'hardware_tuning',
          priority: 'high',
          description: '',
          changes: { maxTokens: 1000 },
          expectedGain: '',
          confidence: 0.9,
          autoApplicable: true,
        },
      ],
      [model],
    )
    expect(out.applied).toBe(1)
    expect(out.updated[0].maxTokens).toBe(1000)
  })

  it('applies reduce_load by clamping maxTokens to the configured cap', async () => {
    const scanner = new PerformanceScanner()
    const out = await scanner.applyOptimizations(
      [
        {
          id: 'o-rl',
          type: 'reduce_load',
          priority: 'high',
          description: '',
          changes: { maxTokens: 800 },
          expectedGain: '',
          confidence: 0.85,
          autoApplicable: true,
        },
      ],
      [model],
    )
    expect(out.applied).toBe(1)
    expect(out.updated[0].maxTokens).toBe(800)
  })
})
