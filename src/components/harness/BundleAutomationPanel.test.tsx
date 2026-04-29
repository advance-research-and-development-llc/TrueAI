import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BundleAutomationPanel } from './BundleAutomationPanel'

describe('BundleAutomationPanel', () => {
  it('renders heading', () => {
    render(
      <BundleAutomationPanel
        messages={[]}
        agents={[]}
        agentRuns={[]}
        harnesses={[]}
      />
    )
    expect(screen.getByText(/bundle/i)).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(
      <BundleAutomationPanel
        messages={[]}
        agents={[]}
        agentRuns={[]}
        harnesses={[]}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
