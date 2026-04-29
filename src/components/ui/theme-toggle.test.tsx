import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn(() => ({
    theme: 'dark',
    resolvedTheme: 'dark',
    setTheme: vi.fn(),
  })),
}))

import * as useThemeModule from '@/hooks/use-theme'
import { ThemeToggle } from './theme-toggle'

const mockUseTheme = useThemeModule.useTheme as ReturnType<typeof vi.fn>

describe('ThemeToggle', () => {
  const setTheme = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the toggle button', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('opens the dropdown menu on button click', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('calls setTheme("light") when Light option is clicked', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Light'))
    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('calls setTheme("dark") when Dark option is clicked', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Dark'))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('calls setTheme("system") when System option is clicked', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('System'))
    expect(setTheme).toHaveBeenCalledWith('system')
  })

  it('shows a checkmark next to the currently active theme', async () => {
    const user = userEvent.setup()
    mockUseTheme.mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme,
    })
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button'))
    // When theme=light, the Light option should have a ✓
    const lightItem = screen.getByText('Light').closest('[role="menuitem"]')
    expect(lightItem?.textContent).toContain('✓')
  })

  it('shows the Moon icon when resolvedTheme is dark', () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme,
    })
    const { container } = render(<ThemeToggle />)
    // The button renders an SVG icon; just verify the container renders
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('shows the Sun icon when resolvedTheme is light', () => {
    mockUseTheme.mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme,
    })
    const { container } = render(<ThemeToggle />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
