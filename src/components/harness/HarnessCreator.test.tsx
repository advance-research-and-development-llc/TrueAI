import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HarnessCreator } from './HarnessCreator'
import type { HarnessManifest } from '@/lib/types'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('HarnessCreator', () => {
  const mockHarnesses: HarnessManifest[] = [
    {
      id: 'harness-1',
      name: 'test-harness',
      version: '1.0.0',
      description: 'A test harness for unit testing',
      author: 'Test Author',
      repository: 'https://github.com/test/repo',
      license: 'MIT',
      tools: [
        {
          name: 'fetch_data',
          description: 'Fetches data from an API',
          returns: 'string',
          parameters: [
            {
              name: 'url',
              type: 'string',
              description: 'The URL to fetch',
              required: true,
            },
            {
              name: 'timeout',
              type: 'number',
              description: 'Request timeout in ms',
              required: false,
              default: 5000,
            },
          ],
        },
      ],
    },
    {
      id: 'harness-2',
      name: 'analytics-harness',
      version: '2.0.0',
      description: 'Analytics and data processing tools',
      author: 'Data Team',
      license: 'Apache-2.0',
      tools: [
        {
          name: 'calculate_stats',
          description: 'Calculates statistical metrics',
          returns: 'object',
          parameters: [
            {
              name: 'data',
              type: 'array',
              description: 'Array of numbers',
              required: true,
            },
          ],
        },
        {
          name: 'generate_report',
          description: 'Generates analytics report',
          returns: 'string',
          parameters: [],
        },
      ],
    },
  ]

  const mockOnCreateHarness = vi.fn()
  const mockOnDeleteHarness = vi.fn()
  const mockOnExportHarness = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders harness creator interface', () => {
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    expect(screen.getByText('Harness Development')).toBeInTheDocument()
    expect(screen.getByText('Create custom tool harnesses for agents')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new harness/i })).toBeInTheDocument()
  })

  it('displays list of existing harnesses', () => {
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    expect(screen.getByText('test-harness')).toBeInTheDocument()
    expect(screen.getByText('analytics-harness')).toBeInTheDocument()
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    expect(screen.getByText('v2.0.0')).toBeInTheDocument()
  })

  it('shows empty state when no harnesses exist', () => {
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    expect(screen.getByText('No harnesses yet')).toBeInTheDocument()
    expect(screen.getByText(/create custom tool harnesses to extend agent capabilities/i)).toBeInTheDocument()
  })

  it('displays harness tool count badge', () => {
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    expect(screen.getByText('1 tools')).toBeInTheDocument()
    expect(screen.getByText('2 tools')).toBeInTheDocument()
  })

  it('opens new harness dialog when New Harness button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))

    await waitFor(() => {
      expect(screen.getByText('Create New Harness')).toBeInTheDocument()
      expect(screen.getByText('Define a new tool harness with custom functionality for agents')).toBeInTheDocument()
    })
  })

  it('requires harness name before creating', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))

    await waitFor(() => {
      expect(screen.getByText('Create New Harness')).toBeInTheDocument()
    })

    // Try to create without name - button should be disabled
    const createButton = screen.getByRole('button', { name: /^create harness$/i })
    expect(createButton).toBeDisabled()
  })

  it('requires at least one tool before creating harness', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))

    await waitFor(() => {
      expect(screen.getByText('Create New Harness')).toBeInTheDocument()
    })

    // Fill in name
    const nameInput = screen.getByLabelText(/name \*/i)
    await user.type(nameInput, 'my-harness')

    // Create button should still be disabled without tools
    const createButton = screen.getByRole('button', { name: /^create harness$/i })
    expect(createButton).toBeDisabled()
  })

  it('allows selecting a harness to view details', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    // Click on first harness
    const harnessCard = screen.getByText('test-harness').closest('div')
    if (harnessCard?.parentElement) {
      await user.click(harnessCard.parentElement)
    }

    await waitFor(() => {
      // Detail view should show version label and license label
      expect(screen.getByText('Version:')).toBeInTheDocument()
      expect(screen.getByText('License:')).toBeInTheDocument()
      // Should show export and preview buttons
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })
  })

  it('displays tools of selected harness with parameters', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    // Click on first harness
    const harnessCard = screen.getByText('test-harness').closest('div')
    if (harnessCard?.parentElement) {
      await user.click(harnessCard.parentElement)
    }

    await waitFor(() => {
      expect(screen.getByText('fetch_data')).toBeInTheDocument()
      expect(screen.getByText('Fetches data from an API')).toBeInTheDocument()
      expect(screen.getByText('→ string')).toBeInTheDocument()
      expect(screen.getByText('url')).toBeInTheDocument()
      expect(screen.getByText('timeout')).toBeInTheDocument()
    })
  })

  it('calls onDeleteHarness when delete button is clicked', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    // Find all buttons, trash icon button should be one of the ghost buttons
    const buttons = screen.getAllByRole('button')
    // The first trash button in the list is for the first harness
    const deleteButton = buttons.find((btn) => {
      const svg = btn.querySelector('svg')
      return svg && btn.className.includes('ghost')
    })

    if (deleteButton) {
      await user.click(deleteButton)
      expect(mockOnDeleteHarness).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Harness deleted')
    }
  })

  it('shows preview dialog with JSON manifest', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    // Select a harness first
    const harnessCard = screen.getByText('test-harness').closest('div')
    if (harnessCard?.parentElement) {
      await user.click(harnessCard.parentElement)
    }

    // Wait for detail view to be visible
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
    })

    // Click preview button
    const previewButton = screen.getByRole('button', { name: /preview/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByText('Harness Manifest Preview')).toBeInTheDocument()
      expect(screen.getByText('JSON representation of your harness')).toBeInTheDocument()
    })
  })

  it('calls onExportHarness when export button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    // Select a harness first
    const harnessCard = screen.getByText('test-harness').closest('div')
    if (harnessCard?.parentElement) {
      await user.click(harnessCard.parentElement)
    }

    // Wait for detail view
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    // Click export button
    const exportButton = screen.getByRole('button', { name: /export/i })
    await user.click(exportButton)

    expect(mockOnExportHarness).toHaveBeenCalledWith('harness-1')
  })

  it('opens add tool dialog from tools tab', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))

    await waitFor(() => {
      expect(screen.getByText('Create New Harness')).toBeInTheDocument()
    })

    // Click on Tools tab
    const toolsTab = screen.getByRole('tab', { name: /tools \(0\)/i })
    await user.click(toolsTab)

    // Find Add Tool button (small variant inside tab content)
    const buttons = screen.getAllByRole('button')
    const addToolButton = buttons.find((btn) =>
      btn.textContent === 'Add Tool' && btn.className.includes('h-8')
    )

    if (addToolButton) {
      await user.click(addToolButton)

      await waitFor(() => {
        expect(screen.getByText('Define a new tool function for this harness')).toBeInTheDocument()
      })
    }
  })

  it('validates tool form before adding', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))
    await waitFor(() => expect(screen.getByText('Create New Harness')).toBeInTheDocument())

    const toolsTab = screen.getByRole('tab', { name: /tools \(0\)/i })
    await user.click(toolsTab)

    // Find Add Tool button
    const buttons = screen.getAllByRole('button')
    const addToolButton = buttons.find((btn) =>
      btn.textContent === 'Add Tool' && btn.className.includes('h-8')
    )

    if (addToolButton) {
      await user.click(addToolButton)

      await waitFor(() => expect(screen.getByText('Define a new tool function for this harness')).toBeInTheDocument())

      // Find the disabled Add Tool button in the dialog footer
      const dialogButtons = screen.getAllByRole('button')
      const submitButton = dialogButtons.find((btn) =>
        btn.textContent === 'Add Tool' && btn.hasAttribute('disabled')
      )
      expect(submitButton).toBeDefined()
    }
  })

  it('allows adding parameters to tools', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))
    await waitFor(() => expect(screen.getByText('Create New Harness')).toBeInTheDocument())

    const toolsTab = screen.getByRole('tab', { name: /tools \(0\)/i })
    await user.click(toolsTab)

    // Find and click Add Tool button
    const buttons = screen.getAllByRole('button')
    const addToolButton = buttons.find((btn) =>
      btn.textContent === 'Add Tool' && btn.className.includes('h-8')
    )

    if (addToolButton) {
      await user.click(addToolButton)

      await waitFor(() => expect(screen.getByText('Define a new tool function for this harness')).toBeInTheDocument())

      // Look for the parameters label and Add button near it
      const paramLabel = screen.getByText(/parameters \(0\)/i)
      expect(paramLabel).toBeInTheDocument()

      // Click the outline variant Add button within parameters section
      const allButtons = screen.getAllByRole('button')
      const paramAddButton = allButtons.find((btn) =>
        btn.textContent === 'Add' && btn.className.includes('outline')
      )

      if (paramAddButton) {
        await user.click(paramAddButton)

        await waitFor(() => {
          expect(screen.getByText('Define a parameter for this tool function')).toBeInTheDocument()
        })
      }
    }
  })

  it('creates harness with correct structure when form is completed', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))
    await waitFor(() => expect(screen.getByText('Create New Harness')).toBeInTheDocument())

    // Fill in basic info
    await user.type(screen.getByLabelText(/name \*/i), 'test-harness')
    await user.clear(screen.getByLabelText(/version/i))
    await user.type(screen.getByLabelText(/version/i), '1.0.0')
    await user.type(screen.getByLabelText(/description/i), 'Test description')
    await user.type(screen.getByLabelText(/author/i), 'Test Author')

    // Switch to tools tab
    const toolsTab = screen.getByRole('tab', { name: /tools \(0\)/i })
    await user.click(toolsTab)

    // Add a tool
    const buttons = screen.getAllByRole('button')
    const addToolBtn = buttons.find((btn) =>
      btn.textContent === 'Add Tool' && btn.className.includes('h-8')
    )
    if (addToolBtn) {
      await user.click(addToolBtn)
    }

    await waitFor(() => expect(screen.getByText('Define a new tool function for this harness')).toBeInTheDocument())

    await user.type(screen.getByLabelText(/function name \*/i), 'test_function')
    const toolDescTextarea = screen.getAllByLabelText(/description \*/i).find(
      (el) => el.id === 'tool-desc'
    )
    if (toolDescTextarea) {
      await user.type(toolDescTextarea, 'Test tool description')
    }

    // Click the enabled Add Tool button in dialog
    const dialogButtons = screen.getAllByRole('button')
    const submitToolButton = dialogButtons.find((btn) =>
      btn.textContent === 'Add Tool' && !btn.hasAttribute('disabled') && btn.getAttribute('data-slot') === 'button'
    )
    if (submitToolButton) {
      await user.click(submitToolButton)
    }

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Tool added')
    })

    // Now create the harness
    const createButton = screen.getByRole('button', { name: /^create harness$/i })
    await user.click(createButton)

    await waitFor(() => {
      expect(mockOnCreateHarness).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-harness',
          version: '1.0.0',
          description: 'Test description',
          author: 'Test Author',
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'test_function',
              description: 'Test tool description',
            }),
          ]),
        })
      )
      expect(toast.success).toHaveBeenCalledWith('Harness created')
    })
  })

  it('supports different license types', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))
    await waitFor(() => expect(screen.getByText('Create New Harness')).toBeInTheDocument())

    // License field should be a select with options
    const licenseSelect = screen.getByLabelText(/license/i)
    expect(licenseSelect).toBeInTheDocument()
  })

  it('shows no selection state by default', () => {
    render(
      <HarnessCreator
        harnesses={mockHarnesses}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    expect(screen.getByText('No Harness Selected')).toBeInTheDocument()
    expect(screen.getByText(/select a harness from the left/i)).toBeInTheDocument()
  })

  it('adds a parameter via the Add Parameter dialog', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))
    await waitFor(() => expect(screen.getByText('Create New Harness')).toBeInTheDocument())

    // Go to Tools tab
    await user.click(screen.getByRole('tab', { name: /tools \(0\)/i }))

    // Open Add Tool dialog
    const addToolBtn = screen.getAllByRole('button').find((b) =>
      b.textContent === 'Add Tool' && b.className.includes('h-8')
    )
    if (addToolBtn) await user.click(addToolBtn)
    await waitFor(() => expect(screen.getByText('Define a new tool function for this harness')).toBeInTheDocument())

    // Fill in Returns field (line 555)
    await user.type(screen.getByLabelText(/return type/i), 'string')

    // Click Add (parameter) button to open Add Parameter dialog
    const addParamBtn = screen.getAllByRole('button').find((b) =>
      b.textContent === 'Add' && b.className.includes('outline')
    )
    if (addParamBtn) await user.click(addParamBtn)
    await waitFor(() => expect(screen.getByText('Define a parameter for this tool function')).toBeInTheDocument())

    // Fill in Add Parameter form - use placeholder since both "Name *" labels exist
    await user.type(screen.getByPlaceholderText('url'), 'my_param')
    const descTextarea = screen.getAllByLabelText(/description \*/i).find(
      (el) => el.id === 'param-desc'
    )
    if (descTextarea) await user.type(descTextarea, 'A test parameter')

    // Submit the Add Parameter dialog
    const addParamSubmit = screen.getAllByRole('button').find((b) =>
      b.textContent === 'Add Parameter' && !b.hasAttribute('disabled')
    )
    if (addParamSubmit) await user.click(addParamSubmit)

    // Parameter should now be listed in the tool parameters section
    await waitFor(() => {
      expect(screen.getByText('my_param')).toBeInTheDocument()
    })
  })

  it('can remove a parameter from the tool form', async () => {
    const user = userEvent.setup()
    render(
      <HarnessCreator
        harnesses={[]}
        onCreateHarness={mockOnCreateHarness}
        onDeleteHarness={mockOnDeleteHarness}
        onExportHarness={mockOnExportHarness}
      />
    )

    await user.click(screen.getByRole('button', { name: /new harness/i }))
    await waitFor(() => expect(screen.getByText('Create New Harness')).toBeInTheDocument())

    await user.click(screen.getByRole('tab', { name: /tools \(0\)/i }))

    const addToolBtn = screen.getAllByRole('button').find((b) =>
      b.textContent === 'Add Tool' && b.className.includes('h-8')
    )
    if (addToolBtn) await user.click(addToolBtn)
    await waitFor(() => expect(screen.getByText('Define a new tool function for this harness')).toBeInTheDocument())

    // Add a parameter
    const addParamBtn = screen.getAllByRole('button').find((b) =>
      b.textContent === 'Add' && b.className.includes('outline')
    )
    if (addParamBtn) await user.click(addParamBtn)
    await waitFor(() => expect(screen.getByText('Define a parameter for this tool function')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('url'), 'deletable')
    const descTextarea = screen.getAllByLabelText(/description \*/i).find(
      (el) => el.id === 'param-desc'
    )
    if (descTextarea) await user.type(descTextarea, 'Will be removed')

    const addParamSubmit = screen.getAllByRole('button').find((b) =>
      b.textContent === 'Add Parameter' && !b.hasAttribute('disabled')
    )
    if (addParamSubmit) await user.click(addParamSubmit)

    await waitFor(() => expect(screen.getByText('deletable')).toBeInTheDocument())

    // Remove the parameter
    const removeBtn = screen.getAllByRole('button').find((b) =>
      b.className.includes('ghost') && b.querySelector('svg')
    )
    if (removeBtn) {
      await user.click(removeBtn)
      await waitFor(() => expect(screen.queryByText('deletable')).not.toBeInTheDocument())
    }
  })

  describe('uncovered handlers (cancel/close + delete + form edits)', () => {
    const setup = () =>
      render(
        <HarnessCreator
          harnesses={mockHarnesses}
          onCreateHarness={mockOnCreateHarness}
          onDeleteHarness={mockOnDeleteHarness}
          onExportHarness={mockOnExportHarness}
        />,
      )

    beforeEach(() => {
      // Stub Radix Select pointer-capture and scrollIntoView for jsdom
      if (!HTMLElement.prototype.hasPointerCapture) {
        HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
      }
      if (!HTMLElement.prototype.releasePointerCapture) {
        HTMLElement.prototype.releasePointerCapture = vi.fn()
      }
      HTMLElement.prototype.scrollIntoView = vi.fn()
    })

    it('Cancel button on the New Harness dialog closes it', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /new harness/i }))
      expect(screen.getByText('Create New Harness')).toBeInTheDocument()
      // Multiple Cancel buttons can appear (nested dialogs); the visible one
      // for the new-harness dialog is the only one mounted at this point.
      await user.click(screen.getByRole('button', { name: /^cancel$/i }))
      await waitFor(() =>
        expect(screen.queryByText('Create New Harness')).not.toBeInTheDocument(),
      )
    })

    it('Cancel button on the Add Tool dialog closes it', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /new harness/i }))
      await user.click(screen.getByRole('tab', { name: /tools/i }))
      await user.click(screen.getByRole('button', { name: /add tool/i }))
      expect(screen.getByText('Define a new tool function for this harness')).toBeInTheDocument()
      const cancels = screen.getAllByRole('button', { name: /^cancel$/i })
      // The most recently opened dialog's cancel is last in DOM order.
      await user.click(cancels[cancels.length - 1])
      await waitFor(() =>
        expect(
          screen.queryByText('Define a new tool function for this harness'),
        ).not.toBeInTheDocument(),
      )
    })

    it('Cancel button on the Add Parameter dialog closes it', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /new harness/i }))
      await user.click(screen.getByRole('tab', { name: /tools/i }))
      await user.click(screen.getByRole('button', { name: /add tool/i }))
      // The "Add" button inside Add Tool dialog opens Add Parameter dialog.
      // It's the only button labelled exactly "Add" at this point.
      const addBtn = screen.getByRole('button', { name: /^add$/i })
      await user.click(addBtn)
      expect(
        screen.getByText('Define a parameter for this tool function'),
      ).toBeInTheDocument()
      const cancels = screen.getAllByRole('button', { name: /^cancel$/i })
      await user.click(cancels[cancels.length - 1])
      await waitFor(() =>
        expect(
          screen.queryByText('Define a parameter for this tool function'),
        ).not.toBeInTheDocument(),
      )
    })

    it('Close button on the Preview dialog closes it', async () => {
      const user = userEvent.setup()
      setup()
      // Select a harness so Preview button becomes available. There may be
      // multiple "test-harness" texts (sidebar card + selected detail), so
      // click the first occurrence.
      const cards = screen.getAllByText('test-harness')
      await user.click(cards[0])
      const previewBtn = screen.getByRole('button', { name: /preview/i })
      await user.click(previewBtn)
      expect(screen.getByText('Harness Manifest Preview')).toBeInTheDocument()
      // Multiple "Close" buttons may exist (e.g., the implicit dialog close
      // X). Use the explicit footer one — last in DOM order.
      const closes = screen.getAllByRole('button', { name: /^close$/i })
      await user.click(closes[closes.length - 1])
      await waitFor(() =>
        expect(screen.queryByText('Harness Manifest Preview')).not.toBeInTheDocument(),
      )
    })

    it('clicking trash on a harness card calls onDeleteHarness and clears selection if it was selected', async () => {
      const { toast } = await import('sonner')
      const user = userEvent.setup()
      setup()
      // Select first harness, then delete it. There may be multiple
      // "test-harness" texts (sidebar + detail header) — click the sidebar one.
      const cards = screen.getAllByText('test-harness')
      await user.click(cards[0])
      // Find the trash button INSIDE the test-harness card. The card is the
      // closest ancestor with the cursor-pointer class.
      const card = cards[0].closest('[class*="cursor-pointer"]') as HTMLElement
      expect(card).toBeTruthy()
      const trashBtn = card.querySelector('button') as HTMLButtonElement
      expect(trashBtn).toBeTruthy()
      await user.click(trashBtn)
      expect(mockOnDeleteHarness).toHaveBeenCalledWith('harness-1')
      expect(toast.success).toHaveBeenCalledWith('Harness deleted')
    })

    it('edits Author and Repository inputs in the New Harness dialog', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /new harness/i }))
      const author = screen.getByLabelText(/author/i)
      await user.type(author, 'Skyler')
      expect((author as HTMLInputElement).value).toBe('Skyler')
      const repo = screen.getByLabelText(/repository/i)
      await user.type(repo, 'https://example.com/repo')
      expect((repo as HTMLInputElement).value).toBe('https://example.com/repo')
    })

    it('changes the License Select in the New Harness dialog', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /new harness/i }))
      const trigger = document.getElementById('harness-license') as HTMLElement
      await user.click(trigger)
      await user.click(await screen.findByRole('option', { name: 'ISC' }))
      expect(trigger.textContent).toMatch(/ISC/)
    })

    it('changes the parameter Type Select, edits Default, and toggles Required', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /new harness/i }))
      await user.click(screen.getByRole('tab', { name: /tools/i }))
      await user.click(screen.getByRole('button', { name: /add tool/i }))
      const addBtn = screen.getByRole('button', { name: /^add$/i })
      await user.click(addBtn)

      const typeTrigger = document.getElementById('param-type') as HTMLElement
      await user.click(typeTrigger)
      await user.click(await screen.findByRole('option', { name: 'number' }))
      expect(typeTrigger.textContent).toMatch(/number/)

      const defaultInput = screen.getByLabelText(/default value/i) as HTMLInputElement
      await user.type(defaultInput, '42')
      expect(defaultInput.value).toBe('42')

      const requiredCheckbox = screen.getByLabelText(/required parameter/i) as HTMLInputElement
      const initial = requiredCheckbox.checked
      await user.click(requiredCheckbox)
      expect(requiredCheckbox.checked).toBe(!initial)
    })

    it('removes a tool from the New Harness dialog tool list (covers removeTool)', async () => {
      const { toast } = await import('sonner')
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /new harness/i }))
      await user.click(screen.getByRole('tab', { name: /tools/i }))
      // Open Add Tool dialog
      await user.click(screen.getByRole('button', { name: /add tool/i }))
      const toolName = screen.getByLabelText(/function name/i)
      await user.type(toolName, 'kill_me')
      const toolDesc = screen.getByLabelText(/^description/i)
      await user.type(toolDesc, 'A removable tool')
      // The footer submit button inside the Add Tool dialog is "Add Tool"
      // (last in DOM since the trigger button on the tab is the same name).
      const submitButtons = screen.getAllByRole('button', { name: /^add tool$/i })
      await user.click(submitButtons[submitButtons.length - 1])
      // After submit, dialog closes and the tool appears in the list
      await waitFor(() =>
        expect(screen.getByText('kill_me')).toBeInTheDocument(),
      )

      // Find and click the trash button next to "kill_me"
      const toolCard = screen.getByText('kill_me').closest('[class*="p-3"]') as HTMLElement
      expect(toolCard).toBeTruthy()
      const removeBtn = toolCard.querySelector('button') as HTMLButtonElement
      await user.click(removeBtn)
      await waitFor(() =>
        expect(screen.queryByText('kill_me')).not.toBeInTheDocument(),
      )
      expect(toast.success).toHaveBeenCalledWith('Tool removed')
    })
  })
})
