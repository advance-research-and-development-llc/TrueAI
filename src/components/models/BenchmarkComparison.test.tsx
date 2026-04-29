import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BenchmarkComparison } from './BenchmarkComparison'
import type { BenchmarkComparison as BenchmarkComparisonType } from '@/lib/benchmark'

const mockMetrics = {
  renderTime: 50,
  interactionLatency: 20,
  memoryUsage: 100,
  frameRate: 60,
  loadTime: 800,
  timestamp: Date.now(),
}

const makeResult = (label: string, score: number) => ({
  id: label,
  label,
  metrics: mockMetrics,
  settings: {
    maxTokens: 2048,
    enableAnimations: true,
    enableBackgroundEffects: false,
    streamingChunkSize: 10,
  },
  score,
})

const mockComparison: BenchmarkComparisonType = {
  before: makeResult('Baseline', 70),
  after: makeResult('Optimized', 85),
  improvements: {
    renderTime: 20,
    interactionLatency: 10,
    memoryUsage: -5,
    frameRate: 5,
    loadTime: 15,
    overallScore: 21.4,
  },
}

describe('BenchmarkComparison', () => {
  it('renders "Performance Comparison" heading', () => {
    render(<BenchmarkComparison comparison={mockComparison} />)
    expect(screen.getByText('Performance Comparison')).toBeInTheDocument()
  })

  it('renders before and after labels', () => {
    render(<BenchmarkComparison comparison={mockComparison} />)
    expect(screen.getByText('Baseline')).toBeInTheDocument()
    expect(screen.getByText('Optimized')).toBeInTheDocument()
  })

  it('renders before score', () => {
    render(<BenchmarkComparison comparison={mockComparison} />)
    expect(screen.getByText('70')).toBeInTheDocument()
  })

  it('renders after score', () => {
    render(<BenchmarkComparison comparison={mockComparison} />)
    expect(screen.getByText('85')).toBeInTheDocument()
  })

  it('renders improvement percentages', () => {
    render(<BenchmarkComparison comparison={mockComparison} />)
    // +21.4% overall improvement should appear somewhere - may be in multiple elements
    const matches = screen.getAllByText(/21\.4/)
    expect(matches.length).toBeGreaterThan(0)
  })
})
