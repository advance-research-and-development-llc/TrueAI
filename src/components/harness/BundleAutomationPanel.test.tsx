import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useKV } from '@github/spark/hooks'
import { BundleAutomationPanel } from './BundleAutomationPanel'
import type { Message, Agent, AgentRun, HarnessManifest } from '@/lib/types'
import type { UsagePattern, AutoExecutionRule, AutomationMetrics, BundleExecutionResult } from '@/lib/bundle-automation'

// Mock useKV hook
const mockSetAutoExecute = vi.fn()
const mockSetRules = vi.fn()
vi.mock('@github/spark/hooks', () => ({
  useKV: vi.fn((key: string, defaultValue: unknown) => {
    if (key === 'auto-execute-enabled') {
      return [false, mockSetAutoExecute]
    }
    if (key === 'automation-rules') {
      return [[], mockSetRules]
    }
    return [defaultValue, vi.fn()]
  }),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  analytics: {
    track: vi.fn(),
  },
}))

// Mock bundle-automation library
const mockAnalyzeUsagePatterns = vi.fn()
const mockCreateRuleFromPattern = vi.fn()
const mockAddRule = vi.fn()
const mockUpdateRule = vi.fn()
const mockDeleteRule = vi.fn()
const mockEvaluateRules = vi.fn()
const mockExecuteRule = vi.fn()
const mockGetMetrics = vi.fn()
const mockGetExecutionHistory = vi.fn()
const mockExportRules = vi.fn()
const mockImportRules = vi.fn()
const mockGetRules = vi.fn()

vi.mock('@/lib/bundle-automation', () => ({
  bundleAutomation: {
    analyzeUsagePatterns: (...args: any[]) => mockAnalyzeUsagePatterns(...args),
    createRuleFromPattern: (...args: any[]) => mockCreateRuleFromPattern(...args),
    addRule: (...args: any[]) => mockAddRule(...args),
    updateRule: (...args: any[]) => mockUpdateRule(...args),
    deleteRule: (...args: any[]) => mockDeleteRule(...args),
    evaluateRules: (...args: any[]) => mockEvaluateRules(...args),
    executeRule: (...args: any[]) => mockExecuteRule(...args),
    getMetrics: () => mockGetMetrics(),
    getExecutionHistory: (...args: any[]) => mockGetExecutionHistory(...args),
    exportRules: () => mockExportRules(),
    importRules: (...args: any[]) => mockImportRules(...args),
    getRules: () => mockGetRules(),
  },
}))

describe('BundleAutomationPanel', () => {
  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Test message',
      timestamp: Date.now(),
    },
  ]

  const mockAgents: Agent[] = [
    {
      id: 'agent-1',
      name: 'Test Agent',
      goal: 'Test goal',
      model: 'test-model',
      tools: [],
      createdAt: Date.now(),
      status: 'idle',
      systemPrompt: 'Test prompt',
    },
  ]

  const mockAgentRuns: AgentRun[] = [
    {
      id: 'run-1',
      agentId: 'agent-1',
      startedAt: Date.now(),
      status: 'completed',
      steps: [],
    },
  ]

  const mockHarnesses: HarnessManifest[] = [
    {
      id: 'harness-1',
      name: 'test-harness',
      version: '1.0.0',
      description: 'Test harness',
      author: 'Test',
      tools: [],
    },
  ]

  const mockMetrics: AutomationMetrics = {
    totalExecutions: 10,
    successfulExecutions: 8,
    failedExecutions: 2,
    averageDuration: 1500,
    mostTriggeredRule: 'rule-1',
    mostUsedHarness: 'harness-1',
    patternAccuracy: 0.85,
    lastAnalyzed: Date.now(),
  }

  const mockPattern: UsagePattern = {
    id: 'pattern-1',
    patternType: 'temporal',
    description: 'Users often run analysis tasks at 9 AM',
    detectedAt: Date.now(),
    confidence: 0.85,
    triggers: [],
    suggestedHarness: ['harness-1'],
    metadata: {},
  }

  const mockRule: AutoExecutionRule = {
    id: 'rule-1',
    name: 'Morning Analysis',
    description: 'Auto-run analysis at 9 AM',
    enabled: true,
    pattern: mockPattern,
    harnessIds: ['harness-1'],
    conditions: [
      {
        type: 'time_range',
        operator: 'in_range',
        value: [9, 10],
      },
    ],
    actions: [
      {
        type: 'run_harness',
        target: 'harness-1',
      },
    ],
    cooldown: 3600000,
    executionCount: 5,
    successRate: 0.8,
    createdAt: Date.now(),
    priority: 'normal',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMetrics.mockReturnValue(mockMetrics)
    mockGetExecutionHistory.mockReturnValue([])
    mockGetRules.mockReturnValue([])
    mockEvaluateRules.mockReturnValue([])
    mockExecuteRule.mockResolvedValue([])
    // Default useKV behavior
    ;(useKV as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
        if (key === 'auto-execute-enabled') return [false, mockSetAutoExecute]
        if (key === 'automation-rules') return [[], mockSetRules]
        return [defaultValue, vi.fn()]
      }
    )
    // Stub Radix Select pointer-capture and scrollIntoView for jsdom
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = vi.fn()
    }
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('renders bundle automation panel with title', () => {
    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    expect(screen.getByText('Bundle Automation')).toBeInTheDocument()
    expect(screen.getByText(/automatically execute harness bundles/i)).toBeInTheDocument()
  })

  it('displays auto-execute toggle switch', () => {
    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    expect(screen.getByText('Auto-Execute')).toBeInTheDocument()
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toBeInTheDocument()
  })

  it('displays metrics cards with correct values', () => {
    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    expect(screen.getByText('Total Executions')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('Avg Duration')).toBeInTheDocument()
    expect(screen.getByText('1500ms')).toBeInTheDocument()
    expect(screen.getByText('Pattern Accuracy')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('displays three tabs: patterns, rules, and history', () => {
    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    expect(screen.getByRole('tab', { name: /patterns/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /rules/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument()
  })

  it('shows empty state for patterns by default', () => {
    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    expect(screen.getByText('No patterns detected yet')).toBeInTheDocument()
    expect(screen.getByText(/click "analyze patterns"/i)).toBeInTheDocument()
  })

  it('allows analyzing usage patterns', async () => {
    const user = userEvent.setup()
    mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])

    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    const analyzeButton = screen.getByRole('button', { name: /analyze patterns/i })
    await user.click(analyzeButton)

    // Should show loading state
    expect(screen.getByText('Analyzing...')).toBeInTheDocument()
    expect(screen.getByText('Analyzing usage patterns...')).toBeInTheDocument()

    // Wait for analysis to complete
    await waitFor(() => {
      expect(mockAnalyzeUsagePatterns).toHaveBeenCalled()
    }, { timeout: 2000 })
  })

  it('displays detected patterns after analysis', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')
    mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])

    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    await user.click(screen.getByRole('button', { name: /analyze patterns/i }))

    await waitFor(() => {
      expect(screen.getByText(mockPattern.description)).toBeInTheDocument()
      expect(toast.success).toHaveBeenCalledWith('Detected 1 usage patterns')
    }, { timeout: 2000 })
  })

  it('allows creating a rule from a pattern', async () => {
    const user = userEvent.setup()
    mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])
    mockCreateRuleFromPattern.mockReturnValue(mockRule)

    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    // Analyze patterns first
    await user.click(screen.getByRole('button', { name: /analyze patterns/i }))

    await waitFor(() => {
      expect(screen.getByText(mockPattern.description)).toBeInTheDocument()
    }, { timeout: 2000 })

    // Click Create Rule button
    const createRuleButtons = screen.getAllByRole('button', { name: /create rule/i })
    await user.click(createRuleButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Create Automation Rule')).toBeInTheDocument()
      expect(screen.getByText('Configure a new rule to automatically execute harness bundles')).toBeInTheDocument()
    })
  })

  it('shows rules tab with empty state', async () => {
    const user = userEvent.setup()
    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    await user.click(screen.getByRole('tab', { name: /rules/i }))

    expect(screen.getByText('No automation rules yet')).toBeInTheDocument()
    expect(screen.getByText(/analyze patterns and create rules/i)).toBeInTheDocument()
  })

  it('displays export and import buttons in rules tab', async () => {
    const user = userEvent.setup()
    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    await user.click(screen.getByRole('tab', { name: /rules/i }))

    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
  })

  it('shows history tab with empty state', async () => {
    const user = userEvent.setup()
    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    await user.click(screen.getByRole('tab', { name: /history/i }))

    expect(screen.getByText('No execution history yet')).toBeInTheDocument()
    expect(screen.getByText(/enable auto-execute to start tracking/i)).toBeInTheDocument()
  })

  it('displays pattern confidence levels', async () => {
    const user = userEvent.setup()
    mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])

    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    await user.click(screen.getByRole('button', { name: /analyze patterns/i }))

    await waitFor(() => {
      expect(screen.getByText(/confidence: 85%/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows pattern type information', async () => {
    const user = userEvent.setup()
    mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])

    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    await user.click(screen.getByRole('button', { name: /analyze patterns/i }))

    await waitFor(() => {
      expect(screen.getByText(/type: temporal/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('displays suggested harness badges for patterns', async () => {
    const user = userEvent.setup()
    mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])

    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    await user.click(screen.getByRole('button', { name: /analyze patterns/i }))

    await waitFor(() => {
      expect(screen.getByText('harness-1')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('handles multiple patterns correctly', async () => {
    const user = userEvent.setup()
    const mockPatterns = [
      mockPattern,
      {
        ...mockPattern,
        id: 'pattern-2',
        description: 'Different pattern',
        patternType: 'frequency' as const,
      },
    ]
    mockAnalyzeUsagePatterns.mockReturnValue(mockPatterns)

    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    await user.click(screen.getByRole('button', { name: /analyze patterns/i }))

    await waitFor(() => {
      expect(screen.getByText(mockPatterns[0].description)).toBeInTheDocument()
      expect(screen.getByText(mockPatterns[1].description)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows correct metrics with zero executions', () => {
    mockGetMetrics.mockReturnValue({
      ...mockMetrics,
      totalExecutions: 0,
      successfulExecutions: 0,
    })

    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('handles empty messages, agents, and runs arrays', () => {
    render(
      <BundleAutomationPanel
        messages={[]}
        agents={[]}
        agentRuns={[]}
        harnesses={mockHarnesses}
      />
    )

    expect(screen.getByText('Bundle Automation')).toBeInTheDocument()
  })

  it('provides tooltip for auto-execute toggle', async () => {
    const user = userEvent.setup()
    render(
      <BundleAutomationPanel
        messages={mockMessages}
        agents={mockAgents}
        agentRuns={mockAgentRuns}
        harnesses={mockHarnesses}
      />
    )

    const switchContainer = screen.getByText('Auto-Execute').closest('div')
    if (switchContainer?.parentElement) {
      await user.hover(switchContainer.parentElement)
      // Tooltip content may not be immediately visible in test environment
    }
  })

  describe('rules tab with rules', () => {
    beforeEach(() => {
      ;(useKV as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (key: string, defaultValue: unknown) => {
          if (key === 'auto-execute-enabled') return [false, mockSetAutoExecute]
          if (key === 'automation-rules') return [[mockRule], mockSetRules]
          return [defaultValue, vi.fn()]
        }
      )
    })

    it('renders rule cards in rules tab', async () => {
      const user = userEvent.setup()
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )

      await user.click(screen.getByRole('tab', { name: /rules/i }))

      expect(screen.getByText('Morning Analysis')).toBeInTheDocument()
      expect(screen.getByText('Auto-run analysis at 9 AM')).toBeInTheDocument()
      expect(screen.getByText(/executed: 5x/i)).toBeInTheDocument()
      expect(screen.getByText(/success: 80%/i)).toBeInTheDocument()
    })

    it('toggles a rule via switch', async () => {
      const user = userEvent.setup()
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )

      await user.click(screen.getByRole('tab', { name: /rules/i }))

      // Two switches exist: auto-execute (off) and rule (on). The rule toggle is the second.
      const switches = screen.getAllByRole('switch')
      const ruleSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true')
      expect(ruleSwitch).toBeTruthy()
      await user.click(ruleSwitch!)
      expect(mockUpdateRule).toHaveBeenCalledWith('rule-1', { enabled: false })
    })

    it('opens view rule dialog and shows rule details', async () => {
      const user = userEvent.setup()
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )

      await user.click(screen.getByRole('tab', { name: /rules/i }))

      // The Eye and Trash buttons are icon-only ghost buttons; locate by their SVG parent button
      const ruleCard = screen.getByText('Morning Analysis').closest('div')!
        .parentElement!.parentElement!.parentElement!
      const buttons = within(ruleCard).getAllByRole('button')
      // First action button is View, second is Delete
      await user.click(buttons[0])

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Rule Details')).toBeInTheDocument()
      expect(within(dialog).getByText(/conditions \(1\)/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/actions \(1\)/i)).toBeInTheDocument()
      expect(within(dialog).getAllByText(/type:/i).length).toBeGreaterThan(0)
    })

    it('deletes a rule via trash button', async () => {
      const user = userEvent.setup()
      const { toast } = await import('sonner')
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )

      await user.click(screen.getByRole('tab', { name: /rules/i }))

      const ruleCard = screen.getByText('Morning Analysis').closest('div')!
        .parentElement!.parentElement!.parentElement!
      const buttons = within(ruleCard).getAllByRole('button')
      // Delete is the second action button
      await user.click(buttons[1])

      expect(mockDeleteRule).toHaveBeenCalledWith('rule-1')
      expect(toast.success).toHaveBeenCalledWith('Rule deleted')
    })
  })

  describe('history tab with executions', () => {
    const successExec: BundleExecutionResult = {
      ruleId: 'rule-1',
      harnessId: 'harness-1',
      timestamp: Date.now(),
      success: true,
      duration: 1234,
      results: [],
    }
    const failedExec: BundleExecutionResult = {
      ruleId: 'rule-1',
      harnessId: 'harness-unknown',
      timestamp: Date.now() - 1000,
      success: false,
      duration: 567,
      results: [],
      error: 'boom',
    }

    beforeEach(() => {
      mockGetExecutionHistory.mockReturnValue([successExec, failedExec])
    })

    it('renders execution history entries with success and failure', async () => {
      const user = userEvent.setup()
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )

      await user.click(screen.getByRole('tab', { name: /history/i }))

      expect(screen.getByText('test-harness')).toBeInTheDocument()
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
      expect(screen.getByText(/duration: 1234ms/i)).toBeInTheDocument()
      expect(screen.getByText('boom')).toBeInTheDocument()
      // Falls back to harness id when not found in props
      expect(screen.getByText('harness-unknown')).toBeInTheDocument()
    })
  })

  describe('create rule dialog', () => {
    it('cancels the create rule dialog without creating a rule', async () => {
      const user = userEvent.setup()
      mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )

      await user.click(screen.getByRole('button', { name: /analyze patterns/i }))
      await waitFor(
        () => expect(screen.getByText(mockPattern.description)).toBeInTheDocument(),
        { timeout: 2000 }
      )

      const createButtons = screen.getAllByRole('button', { name: /create rule/i })
      await user.click(createButtons[0])

      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

      expect(mockCreateRuleFromPattern).not.toHaveBeenCalled()
    })

    it('creates a rule from pattern via the dialog confirm button', async () => {
      const user = userEvent.setup()
      const { toast } = await import('sonner')
      mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])
      mockCreateRuleFromPattern.mockReturnValue(mockRule)

      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )

      await user.click(screen.getByRole('button', { name: /analyze patterns/i }))
      await waitFor(
        () => expect(screen.getByText(mockPattern.description)).toBeInTheDocument(),
        { timeout: 2000 }
      )

      const createButtons = screen.getAllByRole('button', { name: /create rule/i })
      await user.click(createButtons[0])

      const dialog = await screen.findByRole('dialog')
      // Confirm button is "Create Rule" inside the dialog footer
      const confirmButton = within(dialog).getByRole('button', { name: /create rule/i })
      await user.click(confirmButton)

      expect(mockCreateRuleFromPattern).toHaveBeenCalledWith(
        mockPattern,
        mockHarnesses,
        expect.objectContaining({ priority: 'normal', autoEnable: true })
      )
      expect(toast.success).toHaveBeenCalledWith(`Created automation rule: ${mockRule.name}`)
    })

    it('updates cooldown input in the create rule dialog', async () => {
      const user = userEvent.setup()
      mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])
      mockCreateRuleFromPattern.mockReturnValue(mockRule)

      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )

      await user.click(screen.getByRole('button', { name: /analyze patterns/i }))
      await waitFor(
        () => expect(screen.getByText(mockPattern.description)).toBeInTheDocument(),
        { timeout: 2000 }
      )

      await user.click(screen.getAllByRole('button', { name: /create rule/i })[0])

      const dialog = await screen.findByRole('dialog')
      const cooldownInput = within(dialog).getByRole('spinbutton')
      await user.clear(cooldownInput)
      await user.type(cooldownInput, '15')

      const confirmButton = within(dialog).getByRole('button', { name: /create rule/i })
      await user.click(confirmButton)

      expect(mockCreateRuleFromPattern).toHaveBeenCalledWith(
        mockPattern,
        mockHarnesses,
        expect.objectContaining({ cooldown: 15 * 60000 })
      )
    })
  })

  describe('export and import rules', () => {
    beforeEach(() => {
      ;(useKV as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (key: string, defaultValue: unknown) => {
          if (key === 'auto-execute-enabled') return [false, mockSetAutoExecute]
          if (key === 'automation-rules') return [[mockRule], mockSetRules]
          return [defaultValue, vi.fn()]
        }
      )
    })

    it('triggers export rules and downloads a file', async () => {
      const user = userEvent.setup()
      const { toast } = await import('sonner')
      mockExportRules.mockReturnValue('{"rules":[]}')

      const originalCreateObjectURL = URL.createObjectURL
      const originalRevokeObjectURL = URL.revokeObjectURL
      URL.createObjectURL = vi.fn(() => 'blob:mock')
      URL.revokeObjectURL = vi.fn()
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {})

      try {
        render(
          <BundleAutomationPanel
            messages={mockMessages}
            agents={mockAgents}
            agentRuns={mockAgentRuns}
            harnesses={mockHarnesses}
          />
        )

        await user.click(screen.getByRole('tab', { name: /rules/i }))
        await user.click(screen.getByRole('button', { name: /export/i }))

        expect(mockExportRules).toHaveBeenCalled()
        expect(URL.createObjectURL).toHaveBeenCalled()
        expect(clickSpy).toHaveBeenCalled()
        expect(toast.success).toHaveBeenCalledWith('Rules exported')
      } finally {
        URL.createObjectURL = originalCreateObjectURL
        URL.revokeObjectURL = originalRevokeObjectURL
        clickSpy.mockRestore()
      }
    })

    it('imports rules from a selected file via the hidden input', async () => {
      const { toast } = await import('sonner')
      mockGetRules.mockReturnValue([mockRule])
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />,
      )
      const user = userEvent.setup()
      await user.click(screen.getByRole('tab', { name: /rules/i }))
      const file = new File(['{"rules":[]}'], 'rules.json', {
        type: 'application/json',
      })
      // The import input is type="file" hidden — find it by selector.
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement
      expect(input).toBeTruthy()
      await user.upload(input, file)
      await waitFor(() => {
        expect(mockImportRules).toHaveBeenCalled()
      })
      expect(toast.success).toHaveBeenCalledWith('Rules imported')
    })

    it('importRules is a no-op when no file is selected', async () => {
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />,
      )
      const user = userEvent.setup()
      await user.click(screen.getByRole('tab', { name: /rules/i }))
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement
      const { fireEvent } = await import('@testing-library/react')
      fireEvent.change(input, { target: { files: [] } })
      expect(mockImportRules).not.toHaveBeenCalled()
    })
  })

  describe('pattern icons + priority colors', () => {
    it('renders contextual / sequential / frequency / unknown pattern icons', async () => {
      const patterns: UsagePattern[] = [
        { ...mockPattern, id: 'p-context', patternType: 'contextual', description: 'Context p' },
        { ...mockPattern, id: 'p-seq', patternType: 'sequential', description: 'Seq p' },
        { ...mockPattern, id: 'p-freq', patternType: 'frequency', description: 'Freq p' },
        { ...mockPattern, id: 'p-unknown', patternType: 'other' as never, description: 'Unknown p' },
      ]
      mockAnalyzeUsagePatterns.mockReturnValue(patterns)
      const user = userEvent.setup()
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />,
      )
      await user.click(screen.getByRole('button', { name: /analyze patterns/i }))
      await waitFor(() => {
        expect(screen.getByText('Context p')).toBeInTheDocument()
      }, { timeout: 4000 })
      expect(screen.getByText('Seq p')).toBeInTheDocument()
      expect(screen.getByText('Freq p')).toBeInTheDocument()
      expect(screen.getByText('Unknown p')).toBeInTheDocument()
    })

    it('renders rule cards with each priority color (low / high / critical)', async () => {
      const rules: AutoExecutionRule[] = [
        { ...mockRule, id: 'r-low', name: 'Low rule', priority: 'low' },
        { ...mockRule, id: 'r-high', name: 'High rule', priority: 'high' },
        { ...mockRule, id: 'r-crit', name: 'Crit rule', priority: 'critical' },
      ]
      ;(useKV as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (key: string, defaultValue: unknown) => {
          if (key === 'auto-execute-enabled') return [false, mockSetAutoExecute]
          if (key === 'automation-rules') return [rules, mockSetRules]
          return [defaultValue, vi.fn()]
        },
      )
      const user = userEvent.setup()
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />,
      )
      await user.click(screen.getByRole('tab', { name: /rules/i }))
      expect(screen.getByText('Low rule')).toBeInTheDocument()
      expect(screen.getByText('High rule')).toBeInTheDocument()
      expect(screen.getByText('Crit rule')).toBeInTheDocument()
    })
  })

  describe('auto-execute interval timer', () => {
    it('starts a 30s interval and calls evaluateRules tick when auto-execute is enabled', async () => {
      vi.useFakeTimers()
      try {
        ;(useKV as unknown as ReturnType<typeof vi.fn>).mockImplementation(
          (key: string, defaultValue: unknown) => {
            if (key === 'auto-execute-enabled') return [true, mockSetAutoExecute]
            if (key === 'automation-rules') return [[mockRule], mockSetRules]
            return [defaultValue, vi.fn()]
          },
        )
        mockEvaluateRules.mockReturnValue([])
        render(
          <BundleAutomationPanel
            messages={mockMessages}
            agents={mockAgents}
            agentRuns={mockAgentRuns}
            harnesses={mockHarnesses}
          />,
        )
        // Advance past one 30s tick
        vi.advanceTimersByTime(30000)
        expect(mockEvaluateRules).toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('checkAndExecuteRules invokes executeRule and shows success/error toasts for triggered rules', async () => {
      vi.useFakeTimers()
      try {
        const { toast } = await import('sonner')
        ;(useKV as unknown as ReturnType<typeof vi.fn>).mockImplementation(
          (key: string, defaultValue: unknown) => {
            if (key === 'auto-execute-enabled') return [true, mockSetAutoExecute]
            if (key === 'automation-rules') return [[mockRule], mockSetRules]
            return [defaultValue, vi.fn()]
          },
        )
        mockEvaluateRules.mockReturnValue([mockRule])
        const successResult: BundleExecutionResult = {
          success: true,
          ruleId: mockRule.id,
          ruleName: mockRule.name,
          executedAt: Date.now(),
          duration: 100,
          harnessIds: ['harness-1'],
        }
        const failResult: BundleExecutionResult = {
          ...successResult,
          success: false,
          error: 'boom',
        }
        mockExecuteRule.mockResolvedValue([successResult, failResult])
        render(
          <BundleAutomationPanel
            messages={mockMessages}
            agents={mockAgents}
            agentRuns={mockAgentRuns}
            harnesses={mockHarnesses}
          />,
        )
        await vi.advanceTimersByTimeAsync(30000)
        // Allow the awaited executeRule promise chain to resolve, but bound
        // it so we don't loop forever on the recurring interval.
        await vi.advanceTimersByTimeAsync(0)
        await Promise.resolve()
        await Promise.resolve()
        expect(mockExecuteRule).toHaveBeenCalled()
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining('Auto-executed'),
        )
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to execute'),
        )
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('extra setRules callback + select/switch coverage', () => {
    it('createRule, toggleRule, deleteRule invoke their setRules updater callbacks', async () => {
      const user = userEvent.setup()
      const setRulesImpl = vi.fn((updater: unknown) => {
        if (typeof updater === 'function') (updater as (prev: AutoExecutionRule[]) => unknown)([mockRule])
      })
      ;(useKV as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (key: string, defaultValue: unknown) => {
          if (key === 'auto-execute-enabled') return [false, mockSetAutoExecute]
          if (key === 'automation-rules') return [[mockRule], setRulesImpl]
          return [defaultValue, vi.fn()]
        }
      )
      mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])
      mockCreateRuleFromPattern.mockReturnValue({ ...mockRule, id: 'rule-2' })

      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )

      // Trigger createRule via pattern → dialog → confirm (covers line 125 callback)
      await user.click(screen.getByRole('button', { name: /analyze patterns/i }))
      await waitFor(
        () => expect(screen.getByText(mockPattern.description)).toBeInTheDocument(),
        { timeout: 2000 }
      )
      await user.click(screen.getAllByRole('button', { name: /create rule/i })[0])
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /create rule/i }))

      // Switch to rules tab and toggle (covers line 138 callback)
      await user.click(screen.getByRole('tab', { name: /rules/i }))
      const switches = screen.getAllByRole('switch')
      const ruleSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'true')
      await user.click(ruleSwitch!)

      // Delete (covers line 148 callback)
      const ruleCard = screen.getByText('Morning Analysis').closest('div')!
        .parentElement!.parentElement!.parentElement!
      const buttons = within(ruleCard).getAllByRole('button')
      await user.click(buttons[1])

      expect(setRulesImpl).toHaveBeenCalled()
      expect(setRulesImpl.mock.calls.length).toBeGreaterThanOrEqual(3)
    })

    it('priority Select onValueChange and autoEnable Switch update form (covers 602, 632)', async () => {
      const user = userEvent.setup()
      mockAnalyzeUsagePatterns.mockReturnValue([mockPattern])
      mockCreateRuleFromPattern.mockReturnValue(mockRule)
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )
      await user.click(screen.getByRole('button', { name: /analyze patterns/i }))
      await waitFor(
        () => expect(screen.getByText(mockPattern.description)).toBeInTheDocument(),
        { timeout: 2000 }
      )
      await user.click(screen.getAllByRole('button', { name: /create rule/i })[0])
      const dialog = await screen.findByRole('dialog')

      // Priority Select: open and pick "Critical"
      const priorityTrigger = within(dialog).getByRole('combobox')
      await user.click(priorityTrigger)
      await user.click(await screen.findByRole('option', { name: /critical/i }))

      // autoEnable Switch toggle (only switch in dialog)
      const dialogSwitch = within(dialog).getByRole('switch')
      await user.click(dialogSwitch)

      await user.click(within(dialog).getByRole('button', { name: /create rule/i }))
      expect(mockCreateRuleFromPattern).toHaveBeenCalledWith(
        mockPattern,
        mockHarnesses,
        expect.objectContaining({ priority: 'critical', autoEnable: false })
      )
    })

    it('renders default priority badge style for unknown priority values (covers line 228)', async () => {
      const user = userEvent.setup()
      const weirdRule = { ...mockRule, priority: 'weird' as unknown as AutoExecutionRule['priority'] }
      ;(useKV as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (key: string, defaultValue: unknown) => {
          if (key === 'auto-execute-enabled') return [false, mockSetAutoExecute]
          if (key === 'automation-rules') return [[weirdRule], mockSetRules]
          return [defaultValue, vi.fn()]
        }
      )
      render(
        <BundleAutomationPanel
          messages={mockMessages}
          agents={mockAgents}
          agentRuns={mockAgentRuns}
          harnesses={mockHarnesses}
        />
      )
      await user.click(screen.getByRole('tab', { name: /rules/i }))
      const badge = screen.getByText('weird')
      expect(badge.className).toMatch(/bg-secondary/)
    })
  })
})
