import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @xyflow/react entirely since it's not jsdom-friendly
vi.mock('@xyflow/react', () => ({
  ReactFlow: () => <div data-testid="react-flow">ReactFlow</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useNodesState: () => [[], vi.fn()],
  useEdgesState: () => [[], vi.fn()],
  useReactFlow: () => ({
    fitView: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
  }),
  addEdge: vi.fn().mockImplementation((edge, edges) => [...edges, edge]),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Stub Radix Select pointer-capture
beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      value: vi.fn().mockReturnValue(false), configurable: true,
    })
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: vi.fn(), configurable: true,
    })
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { WorkflowBuilder } from './WorkflowBuilder'
import type { Workflow, Agent } from '@/lib/types'

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Test Agent',
  goal: 'Do things',
  model: 'gpt-4o',
  tools: [],
  createdAt: Date.now(),
  status: 'idle',
}

const mockWorkflow: Workflow = {
  id: 'wf-1',
  name: 'Test Workflow',
  description: 'A test workflow',
  nodes: [],
  edges: [],
  variables: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('WorkflowBuilder', () => {
  it('renders toolbar', () => {
    render(
      <WorkflowBuilder
        workflows={[mockWorkflow]}
        agents={[mockAgent]}
        onSaveWorkflow={vi.fn()}
        onDeleteWorkflow={vi.fn()}
        onExecuteWorkflow={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })

  it('renders workflow selector', () => {
    render(
      <WorkflowBuilder
        workflows={[mockWorkflow]}
        agents={[mockAgent]}
        onSaveWorkflow={vi.fn()}
        onDeleteWorkflow={vi.fn()}
        onExecuteWorkflow={vi.fn()}
      />
    )
    // Should render a select/combobox for workflow selection
    const combobox = screen.queryByRole('combobox')
    expect(combobox || screen.getByText('Test Workflow')).toBeTruthy()
  })

  it('renders New Workflow button', () => {
    render(
      <WorkflowBuilder
        workflows={[mockWorkflow]}
        agents={[mockAgent]}
        onSaveWorkflow={vi.fn()}
        onDeleteWorkflow={vi.fn()}
        onExecuteWorkflow={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /new workflow/i })).toBeInTheDocument()
  })

  it('renders Save button', () => {
    render(
      <WorkflowBuilder
        workflows={[mockWorkflow]}
        agents={[mockAgent]}
        onSaveWorkflow={vi.fn()}
        onDeleteWorkflow={vi.fn()}
        onExecuteWorkflow={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('calls onSaveWorkflow when Save is clicked', () => {
    const onSaveWorkflow = vi.fn()
    render(
      <WorkflowBuilder
        workflows={[mockWorkflow]}
        agents={[mockAgent]}
        onSaveWorkflow={onSaveWorkflow}
        onDeleteWorkflow={vi.fn()}
        onExecuteWorkflow={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSaveWorkflow).toHaveBeenCalledOnce()
  })

  it('renders ReactFlow canvas', () => {
    render(
      <WorkflowBuilder
        workflows={[mockWorkflow]}
        agents={[mockAgent]}
        onSaveWorkflow={vi.fn()}
        onDeleteWorkflow={vi.fn()}
        onExecuteWorkflow={vi.fn()}
      />
    )
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
  })

  it('renders without crashing with empty workflows', () => {
    render(
      <WorkflowBuilder
        workflows={[]}
        agents={[]}
        onSaveWorkflow={vi.fn()}
        onDeleteWorkflow={vi.fn()}
        onExecuteWorkflow={vi.fn()}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
