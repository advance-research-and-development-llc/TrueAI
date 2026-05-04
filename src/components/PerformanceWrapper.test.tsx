import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerformanceWrapper } from './PerformanceWrapper'

vi.mock('@/hooks/use-auto-performance', () => ({
  useAutoPerformanceOptimization: vi.fn(() => ({
    capabilities: null,
    isOptimized: false
  }))
}))

vi.mock('@/lib/mobile-performance', () => ({
  MobilePerformanceOptimizer: {
    getInstance: vi.fn(() => ({
      getOptimizedSettings: vi.fn(() => ({ animationDuration: 300 }))
    }))
  },
  ImageCache: { has: vi.fn(() => false), get: vi.fn(), set: vi.fn() },
  useIntersectionObserver: vi.fn(() => true),
  useThrottle: (fn: (...args: unknown[]) => unknown) => fn
}))

vi.mock('@/lib/resource-loader', () => ({
  ResourceLoader: { getInstance: vi.fn(() => ({})) },
  optimizeResourceLoading: vi.fn()
}))

describe('PerformanceWrapper', () => {
  it('renders children', () => {
    render(<PerformanceWrapper><span>hello</span></PerformanceWrapper>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('renders multiple children', () => {
    render(<PerformanceWrapper><span>a</span><span>b</span></PerformanceWrapper>)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
  })

  it('applies low-performance styles when tier is low', async () => {
    const { useAutoPerformanceOptimization } = await import('@/hooks/use-auto-performance')
    vi.mocked(useAutoPerformanceOptimization).mockReturnValue({
      capabilities: { tier: 'low', cores: 2, memory: 2, gpu: '', connection: '3g', saveData: false, batteryLevel: 1, charging: true },
      isOptimized: true,
      settings: null,
      isLowEnd: true,
      isMidTier: false,
      isHighEnd: false,
      shouldReduceMotion: true
    })
    render(<PerformanceWrapper><div>content</div></PerformanceWrapper>)
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('adds save-data-mode class when capabilities.saveData is true', async () => {
    document.body.classList.remove('save-data-mode')
    const { useAutoPerformanceOptimization } = await import('@/hooks/use-auto-performance')
    vi.mocked(useAutoPerformanceOptimization).mockReturnValue({
      capabilities: { tier: 'high', cores: 8, memory: 16, gpu: '', connection: '4g', saveData: true, batteryLevel: 1, charging: true },
      isOptimized: true,
      settings: null,
      isLowEnd: false,
      isMidTier: false,
      isHighEnd: true,
      shouldReduceMotion: false
    })
    render(<PerformanceWrapper><div>sd</div></PerformanceWrapper>)
    expect(document.body.classList.contains('save-data-mode')).toBe(true)
  })

  it('warns on long PerformanceObserver tasks and falls back when observe throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    let capturedCb: ((list: { getEntries: () => Array<{ duration: number }> }) => void) | null = null
    class FakePO {
      constructor(cb: (list: { getEntries: () => Array<{ duration: number }> }) => void) {
        capturedCb = cb
      }
      observe() { throw new Error('not supported') }
      disconnect() {}
    }
    const originalPO = (window as unknown as { PerformanceObserver: unknown }).PerformanceObserver
    ;(window as unknown as { PerformanceObserver: unknown }).PerformanceObserver = FakePO
    const { useAutoPerformanceOptimization } = await import('@/hooks/use-auto-performance')
    vi.mocked(useAutoPerformanceOptimization).mockReturnValue({
      capabilities: { tier: 'mid', cores: 4, memory: 8, gpu: '', connection: '4g', saveData: false, batteryLevel: 1, charging: true },
      isOptimized: true,
      settings: null,
      isLowEnd: false,
      isMidTier: true,
      isHighEnd: false,
      shouldReduceMotion: false
    })
    render(<PerformanceWrapper><div>po</div></PerformanceWrapper>)
    expect(capturedCb).not.toBeNull()
    capturedCb!({ getEntries: () => [{ duration: 120 }, { duration: 10 }] })
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Long task detected: 120/))
    expect(info).toHaveBeenCalledWith('Long task monitoring not available')
    ;(window as unknown as { PerformanceObserver: unknown }).PerformanceObserver = originalPO
    warn.mockRestore()
    info.mockRestore()
  })
})
