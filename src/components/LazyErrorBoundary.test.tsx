import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LazyErrorBoundary } from './LazyErrorBoundary'

// A component that throws on demand
function Thrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test render error')
  return <div>Loaded successfully</div>
}

describe('LazyErrorBoundary', () => {
  beforeEach(() => {
    // Suppress the React error boundary console.error noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children normally when no child throws', () => {
    render(
      <LazyErrorBoundary>
        <div>Normal content</div>
      </LazyErrorBoundary>
    )
    expect(screen.getByText('Normal content')).toBeInTheDocument()
  })

  it('shows error fallback when a child throws', () => {
    render(
      <LazyErrorBoundary>
        <Thrower shouldThrow />
      </LazyErrorBoundary>
    )
    expect(screen.getByText('Component Failed to Load')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })

  it('displays the default fallback message when no custom message is provided', () => {
    render(
      <LazyErrorBoundary>
        <Thrower shouldThrow />
      </LazyErrorBoundary>
    )
    expect(
      screen.getByText('Unable to load this component. Please check your connection and try again.')
    ).toBeInTheDocument()
  })

  it('uses custom componentName in the heading', () => {
    render(
      <LazyErrorBoundary componentName="MyWidget">
        <Thrower shouldThrow />
      </LazyErrorBoundary>
    )
    expect(screen.getByText('MyWidget Failed to Load')).toBeInTheDocument()
  })

  it('uses custom fallbackMessage', () => {
    render(
      <LazyErrorBoundary fallbackMessage="Oops, something went wrong.">
        <Thrower shouldThrow />
      </LazyErrorBoundary>
    )
    expect(screen.getByText('Oops, something went wrong.')).toBeInTheDocument()
  })

  it('shows Technical Details with error message when an error occurs', () => {
    render(
      <LazyErrorBoundary>
        <Thrower shouldThrow />
      </LazyErrorBoundary>
    )
    expect(screen.getByText('Technical Details')).toBeInTheDocument()
    expect(screen.getByText('Test render error')).toBeInTheDocument()
  })

  it('resets to normal state when Retry button is clicked', async () => {
    const user = userEvent.setup()
    let throws = true

    function ConditionalThrower() {
      if (throws) throw new Error('Transient error')
      return <div>Recovered content</div>
    }

    render(
      <LazyErrorBoundary>
        <ConditionalThrower />
      </LazyErrorBoundary>
    )

    expect(screen.getByText('Component Failed to Load')).toBeInTheDocument()

    // Stop throwing before clicking Retry so that the re-render succeeds
    throws = false
    await user.click(screen.getByRole('button', { name: /Retry/i }))

    expect(screen.getByText('Recovered content')).toBeInTheDocument()
    expect(screen.queryByText('Component Failed to Load')).not.toBeInTheDocument()
  })

  it('renders an SVG warning icon in the error state', () => {
    const { container } = render(
      <LazyErrorBoundary>
        <Thrower shouldThrow />
      </LazyErrorBoundary>
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('logs the error via console.error', () => {
    render(
      <LazyErrorBoundary componentName="BrokenComp">
        <Thrower shouldThrow />
      </LazyErrorBoundary>
    )
    expect(console.error).toHaveBeenCalled()
  })
})
