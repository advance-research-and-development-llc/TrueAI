import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OfflineFallback } from './OfflineFallback'

describe('OfflineFallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the offline title', () => {
    render(<OfflineFallback />)
    expect(screen.getByText("You're offline")).toBeInTheDocument()
  })

  it('renders the offline description message', () => {
    render(<OfflineFallback />)
    expect(
      screen.getByText(/This page is not available offline/)
    ).toBeInTheDocument()
  })

  it('renders the Try Again button', () => {
    render(<OfflineFallback />)
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
  })

  it('renders the Go to Home button', () => {
    render(<OfflineFallback />)
    expect(screen.getByRole('button', { name: /Go to Home/i })).toBeInTheDocument()
  })

  it('calls window.location.reload when Try Again is clicked', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('location', { reload: vi.fn(), href: '' })

    render(<OfflineFallback />)
    await user.click(screen.getByRole('button', { name: /Try Again/i }))

    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it('navigates to "/" when Go to Home is clicked', async () => {
    const user = userEvent.setup()
    const location = { reload: vi.fn(), href: '' }
    vi.stubGlobal('location', location)

    render(<OfflineFallback />)
    await user.click(screen.getByRole('button', { name: /Go to Home/i }))

    expect(location.href).toBe('/')
  })

  it('renders a WifiSlash icon (SVG)', () => {
    const { container } = render(<OfflineFallback />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders the cached-content footnote', () => {
    render(<OfflineFallback />)
    expect(
      screen.getByText(/Cached pages and previously loaded content/)
    ).toBeInTheDocument()
  })
})
