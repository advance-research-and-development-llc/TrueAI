/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { BenchmarkRunner } from './BenchmarkRunner'
import { runModelBenchmark, benchmarkTests } from '@/lib/model-benchmark'

vi.mock('@/lib/model-benchmark', async () => {
  const actual = await vi.importActual<typeof import('@/lib/model-benchmark')>('@/lib/model-benchmark')
  return {
    ...actual,
    runModelBenchmark: vi.fn(),
  }
})

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const mockModel = {
  id: 'm1', name: 'Test Model', provider: 'ollama' as const,
  temperature: 0.7, maxTokens: 2000, topP: 0.9,
  frequencyPenalty: 0, presencePenalty: 0,
}

const makeRun = (testId: string, overrides: Partial<any> = {}): any => ({
  id: `run-${testId}`,
  modelId: 'm1',
  testId,
  parameters: {},
  startTime: 0,
  endTime: 100,
  responseTime: 120,
  response: 'sample response',
  tokensPerSecond: 42,
  qualityScore: 80,
  qualityBreakdown: { relevance: 80, coherence: 75, creativity: 70, accuracy: 85 },
  ...overrides,
})

const makeSuite = (overrides: Partial<any> = {}, testCount = 2): any => ({
  id: 'suite-1',
  modelId: 'm1',
  parameters: {},
  // Use real benchmarkTests IDs so testDef lookup populates the cards.
  tests: benchmarkTests.slice(0, testCount).map(t => makeRun(t.id)),
  overallScore: 80,
  averageResponseTime: 120,
  averageTokensPerSecond: 42,
  timestamp: Date.now(),
  status: 'completed',
  ...overrides,
})

describe('BenchmarkRunner', () => {
  beforeAll(() => {
    HTMLElement.prototype.hasPointerCapture = vi.fn()
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.releasePointerCapture = vi.fn()
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })
  afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'hasPointerCapture')
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture')
    Reflect.deleteProperty(HTMLElement.prototype, 'releasePointerCapture')
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    ;(runModelBenchmark as any).mockResolvedValue(makeSuite())
  })

  it('renders heading + Run Benchmark button + model name', () => {
    render(<BenchmarkRunner models={[mockModel]} />)
    expect(screen.getByText(/run benchmark/i)).toBeInTheDocument()
    expect(screen.getByText('Test Model')).toBeInTheDocument()
  })

  it('renders benchmark test checkboxes', () => {
    const { container } = render(<BenchmarkRunner models={[mockModel]} />)
    expect(container.querySelectorAll('[role="checkbox"]').length).toBeGreaterThan(0)
  })

  it('with empty models, Run Benchmark button is disabled', () => {
    render(<BenchmarkRunner models={[]} />)
    expect(screen.getByRole('button', { name: /run benchmark/i })).toBeDisabled()
  })

  it('successful run: calls runModelBenchmark with selected model + parameters + tests, calls onBenchmarkComplete, renders Results with metrics', async () => {
    const cb = vi.fn()
    render(<BenchmarkRunner models={[mockModel]} onBenchmarkComplete={cb} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect(runModelBenchmark).toHaveBeenCalledOnce())
    const [modelArg, paramsArg, testsArg, progressCb] = (runModelBenchmark as any).mock.calls[0]
    expect(modelArg).toBe(mockModel)
    expect(paramsArg).toEqual({
      temperature: 0.7, maxTokens: 2000, topP: 0.9, frequencyPenalty: 0, presencePenalty: 0,
    })
    expect(testsArg.length).toBe(benchmarkTests.length)
    expect(typeof progressCb).toBe('function')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Benchmark completed'))
    // Results card with 4 metric cards
    await waitFor(() => expect(screen.getByText(/overall score/i)).toBeInTheDocument())
    expect(screen.getByText(/avg response/i)).toBeInTheDocument()
    expect(screen.getByText(/throughput/i)).toBeInTheDocument()
    expect(screen.getByText(/success rate/i)).toBeInTheDocument()
  })

  it('Run Benchmark with no tests selected: button becomes disabled', async () => {
    render(<BenchmarkRunner models={[mockModel]} />)
    // Deselect every individual test by clicking each test-id checkbox.
    for (const t of benchmarkTests) {
      const cb = document.getElementById(t.id) as HTMLElement
      await act(async () => { fireEvent.click(cb) })
    }
    expect(screen.getByText(`0 / ${benchmarkTests.length} tests`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run benchmark/i })).toBeDisabled()
  })

  it('benchmark failure path: toast.error + console.error swallowed', async () => {
    ;(runModelBenchmark as any).mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<BenchmarkRunner models={[mockModel]} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Benchmark failed')),
    )
    errSpy.mockRestore()
  })

  it('individual test toggle: clicking test checkbox flips inclusion (count badge updates)', async () => {
    render(<BenchmarkRunner models={[mockModel]} />)
    expect(screen.getByText(`${benchmarkTests.length} / ${benchmarkTests.length} tests`)).toBeInTheDocument()
    // Click first test-row checkbox (the test ones use ids matching benchmarkTests[i].id)
    const firstTestCheckbox = document.getElementById(benchmarkTests[0].id) as HTMLElement
    expect(firstTestCheckbox).toBeTruthy()
    await act(async () => { fireEvent.click(firstTestCheckbox) })
    expect(screen.getByText(`${benchmarkTests.length - 1} / ${benchmarkTests.length} tests`)).toBeInTheDocument()
    // Toggle back on
    await act(async () => { fireEvent.click(firstTestCheckbox) })
    expect(screen.getByText(`${benchmarkTests.length} / ${benchmarkTests.length} tests`)).toBeInTheDocument()
  })

  it('task-type group toggle: clicking task-group checkbox flips entire group on/off', async () => {
    render(<BenchmarkRunner models={[mockModel]} />)
    // creative_writing has 1 test → click its group checkbox to toggle off
    const groupCheckbox = document.getElementById('task-creative_writing') as HTMLElement
    expect(groupCheckbox).toBeTruthy()
    await act(async () => { fireEvent.click(groupCheckbox) })
    expect(screen.getByText(`${benchmarkTests.length - 1} / ${benchmarkTests.length} tests`)).toBeInTheDocument()
    // Toggle back on (selectedTests no longer has creative_writing tests, so allSelected is false)
    await act(async () => { fireEvent.click(groupCheckbox) })
    expect(screen.getByText(`${benchmarkTests.length} / ${benchmarkTests.length} tests`)).toBeInTheDocument()
  })

  it('Results tab renders per-test cards: success card with quality breakdown + error card with error text', async () => {
    const errRun = makeRun(benchmarkTests[1].id, { error: 'mock-error', qualityScore: 0 })
    const successRun = makeRun(benchmarkTests[0].id)
    ;(runModelBenchmark as any).mockResolvedValueOnce(makeSuite({ tests: [successRun, errRun] }))

    render(<BenchmarkRunner models={[mockModel]} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect(screen.getByText(/overall score/i)).toBeInTheDocument())
    // Success card shows quality breakdown labels
    expect(screen.getByText(/relevance:/i)).toBeInTheDocument()
    expect(screen.getByText(/coherence:/i)).toBeInTheDocument()
    expect(screen.getByText(/creativity:/i)).toBeInTheDocument()
    expect(screen.getByText(/accuracy:/i)).toBeInTheDocument()
    // Error card surfaces the error text
    expect(screen.getByText('mock-error')).toBeInTheDocument()
    // Success rate is 1/2 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('forwards progress callback to setProgress/setCurrentTest during a run', async () => {
    ;(runModelBenchmark as any).mockImplementationOnce(async (_m, _p, _t, prog) => {
      prog?.(10, 'first-test')
      prog?.(80, 'last-test')
      return makeSuite()
    })
    render(<BenchmarkRunner models={[mockModel]} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Benchmark completed')),
    )
  })

  it('renders red score color when overallScore < 60 (and destructive badge)', async () => {
    ;(runModelBenchmark as any).mockResolvedValueOnce(
      makeSuite({ id: 'suite-low', overallScore: 42 }),
    )
    render(<BenchmarkRunner models={[mockModel]} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect(screen.getByText(/overall score/i)).toBeInTheDocument())
    const reds = screen.getAllByText('42.0').filter(el => /text-red-500/.test(el.className))
    expect(reds.length).toBeGreaterThan(0)
  })

  it('renders yellow score badge when overallScore is in [60, 80)', async () => {
    ;(runModelBenchmark as any).mockResolvedValueOnce(
      makeSuite({ id: 'suite-mid', overallScore: 65 }),
    )
    render(<BenchmarkRunner models={[mockModel]} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect(screen.getByText(/overall score/i)).toBeInTheDocument())
    const yellows = screen.getAllByText('65.0').filter(el => /text-yellow-500/.test(el.className))
    expect(yellows.length).toBeGreaterThan(0)
  })

  it('result-picker Select switches the active result when multiple suites exist', async () => {
    const user = userEvent.setup()
    ;(runModelBenchmark as any).mockResolvedValueOnce(
      makeSuite({ id: 'suite-a', timestamp: 1000, overallScore: 70 }),
    )
    render(<BenchmarkRunner models={[mockModel]} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect(screen.getByText(/overall score/i)).toBeInTheDocument())

    ;(runModelBenchmark as any).mockResolvedValueOnce(
      makeSuite({ id: 'suite-b', timestamp: 2000, overallScore: 88 }),
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect((runModelBenchmark as any).mock.calls.length).toBe(2))

    // After 2 runs, the result-picker Select renders (results.length > 0).
    // It carries className 'w-48' which uniquely identifies it.
    const triggers = Array.from(document.querySelectorAll('[role="combobox"]')) as HTMLElement[]
    const trigger = triggers.find(t => /\bw-48\b/.test(t.className))
    expect(trigger).toBeTruthy()
    await user.click(trigger!)
    const oldOption = await screen.findByRole('option', { name: /-\s*70$/ })
    await user.click(oldOption)
    // Active overall score becomes 70.0.
    await waitFor(() => expect(screen.getAllByText('70.0').length).toBeGreaterThan(0))
  })

  it('Comparison tab: declined-tests card renders when comparison run scores lower', async () => {
    const user = userEvent.setup()
    // Baseline: high quality on 2 tests
    ;(runModelBenchmark as any).mockResolvedValueOnce(
      makeSuite({
        id: 'suite-base-hi',
        timestamp: 1000,
        overallScore: 90,
        averageResponseTime: 100,
        averageTokensPerSecond: 60,
        tests: benchmarkTests.slice(0, 2).map(t => makeRun(t.id, { qualityScore: 95 })),
      }),
    )
    render(<BenchmarkRunner models={[mockModel]} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect(screen.getByText(/overall score/i)).toBeInTheDocument())

    // Comparison: lower quality on the same 2 tests → worseTests populated
    ;(runModelBenchmark as any).mockResolvedValueOnce(
      makeSuite({
        id: 'suite-cmp-lo',
        timestamp: 2000,
        overallScore: 60,
        averageResponseTime: 300,
        averageTokensPerSecond: 20,
        tests: benchmarkTests.slice(0, 2).map(t => makeRun(t.id, { qualityScore: 50 })),
      }),
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect((runModelBenchmark as any).mock.calls.length).toBe(2))

    await user.click(screen.getByRole('tab', { name: /compare/i }))
    const baselineTrigger = (await screen.findByText('Select baseline'))
      .closest('[role="combobox"]') as HTMLElement
    await user.click(baselineTrigger)
    const baselineOption = await screen.findByRole('option', { name: /-\s*90$/ })
    await user.click(baselineOption)

    await waitFor(() => expect(screen.getByText(/declined tests/i)).toBeInTheDocument())
  })

  it('Comparison tab (legacy): pick baseline + comparison via Selects → recommendation card and delta cards', async () => {
    const user = userEvent.setup()
    ;(runModelBenchmark as any).mockResolvedValueOnce(
      makeSuite({ id: 'suite-base', timestamp: 1000, overallScore: 70, averageResponseTime: 200, averageTokensPerSecond: 30 })
    )
    render(<BenchmarkRunner models={[mockModel]} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect(screen.getByText(/overall score/i)).toBeInTheDocument())

    ;(runModelBenchmark as any).mockResolvedValueOnce(
      makeSuite({
        id: 'suite-cmp', timestamp: 2000, overallScore: 90,
        averageResponseTime: 100, averageTokensPerSecond: 60,
        tests: benchmarkTests.slice(0, 2).map(t => makeRun(t.id, { qualityScore: 95 })),
      })
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run benchmark/i }))
    })
    await waitFor(() => expect((runModelBenchmark as any).mock.calls.length).toBe(2))

    await user.click(screen.getByRole('tab', { name: /compare/i }))
    const baselineTrigger = (await screen.findByText('Select baseline'))
      .closest('[role="combobox"]') as HTMLElement
    await user.click(baselineTrigger)
    const baselineOption = await screen.findByRole('option', { name: /-\s*70$/ })
    await user.click(baselineOption)

    await waitFor(() => expect(screen.getByText(/recommendation/i)).toBeInTheDocument())
    expect(screen.getByText(/improved tests/i)).toBeInTheDocument()
  })
})
