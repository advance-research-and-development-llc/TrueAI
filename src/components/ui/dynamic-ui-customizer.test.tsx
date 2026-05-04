import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockUseDynamicUI, updatePreference, setPreferences } = vi.hoisted(() => ({
  mockUseDynamicUI: vi.fn(),
  updatePreference: vi.fn(),
  setPreferences: vi.fn(),
}))

vi.mock('@/hooks/use-dynamic-ui', () => ({
  useDynamicUI: mockUseDynamicUI,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { DynamicUICustomizer } from './dynamic-ui-customizer'

const defaultPreferences = {
  layoutDensity: 'comfortable' as const,
  colorScheme: 'default' as const,
  sidebarPosition: 'left' as const,
  chatBubbleStyle: 'rounded' as const,
  animationIntensity: 'normal' as const,
  fontSize: 'medium' as const,
  cardStyle: 'elevated' as const,
  accentColor: 'oklch(0.75 0.14 200)',
  backgroundPattern: 'dots' as const,
  autoAdaptLayout: true,
  smartSpacing: true,
  contextualColors: true,
}

describe('DynamicUICustomizer', () => {
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
    mockUseDynamicUI.mockReturnValue({
      preferences: { ...defaultPreferences },
      updatePreference,
      setPreferences,
    })
  })

  it('returns null when preferences are not yet loaded', () => {
    mockUseDynamicUI.mockReturnValueOnce({
      preferences: null,
      updatePreference,
      setPreferences,
    })
    const { container } = render(<DynamicUICustomizer />)
    expect(container.firstChild).toBeNull()
  })

  it('renders heading, preset buttons, and tab list', () => {
    render(<DynamicUICustomizer />)
    expect(screen.getByText('Dynamic UI Customization')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Default' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Minimal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vibrant' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'High Contrast' })).toBeInTheDocument()
  })

  it('applies a preset and shows toast on click', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('button', { name: 'Vibrant' }))

    expect(setPreferences).toHaveBeenCalledTimes(1)
    // setPreferences receives an updater function — invoke it to verify shape
    const updater = setPreferences.mock.calls[0][0] as (
      p: typeof defaultPreferences,
    ) => typeof defaultPreferences
    const next = updater(defaultPreferences)
    expect(next.colorScheme).toBe('vibrant')
    expect(next.cardStyle).toBe('glass')
    expect(toast.success).toHaveBeenCalledWith('Applied Vibrant theme')
  })

  it('toggles auto-adapt switch via updatePreference', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    // First switch on the layout tab is "Auto-Adapt Layout"
    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])
    expect(updatePreference).toHaveBeenCalledWith('autoAdaptLayout', false)
  })

  it('toggles smart-spacing switch via updatePreference', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    const switches = screen.getAllByRole('switch')
    // Second switch on layout tab is "Smart Spacing"
    await user.click(switches[1])
    expect(updatePreference).toHaveBeenCalledWith('smartSpacing', false)
  })

  it('switches to the appearance tab and renders appearance controls', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Style/ }))
    expect(screen.getByText('Color Scheme')).toBeInTheDocument()
    expect(screen.getByText('Card Style')).toBeInTheDocument()
    expect(screen.getByText('Background Pattern')).toBeInTheDocument()
    expect(screen.getByText('Chat Bubble Style')).toBeInTheDocument()
  })

  it('switches to the typography tab and shows the preview', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Text/ }))
    expect(screen.getByText('Sample Heading')).toBeInTheDocument()
    expect(screen.getByText(/This is how your text will appear/)).toBeInTheDocument()
  })

  it('switches to the effects tab and renders the animation preview', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Effects/ }))
    expect(screen.getByText('Animation Intensity')).toBeInTheDocument()
    expect(screen.getByText('Animation Preview')).toBeInTheDocument()
  })

  it('renders the static (non-animated) preview when animationIntensity is none', async () => {
    mockUseDynamicUI.mockReturnValue({
      preferences: { ...defaultPreferences, animationIntensity: 'none' as const },
      updatePreference,
      setPreferences,
    })
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Effects/ }))
    expect(screen.getByText('Animation Preview')).toBeInTheDocument()
  })

  it('renders typography preview with small / large / xlarge font sizes', async () => {
    for (const size of ['small', 'large', 'xlarge'] as const) {
      mockUseDynamicUI.mockReturnValue({
        preferences: { ...defaultPreferences, fontSize: size },
        updatePreference,
        setPreferences,
      })
      const user = userEvent.setup()
      const { unmount } = render(<DynamicUICustomizer />)
      await user.click(screen.getByRole('tab', { name: /Text/ }))
      expect(screen.getByText('Sample Heading')).toBeInTheDocument()
      unmount()
    }
  })

  it('changes Layout Density via the Select and calls updatePreference', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    // Default tab is "layout". Find the first Select trigger (Layout Density).
    const triggers = screen.getAllByRole('combobox')
    await user.click(triggers[0])
    await user.click(await screen.findByRole('option', { name: 'Spacious' }))
    expect(updatePreference).toHaveBeenCalledWith('layoutDensity', 'spacious')
  })

  it('changes Sidebar Position via the Select', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    const triggers = screen.getAllByRole('combobox')
    await user.click(triggers[1])
    await user.click(await screen.findByRole('option', { name: 'Right' }))
    expect(updatePreference).toHaveBeenCalledWith('sidebarPosition', 'right')
  })

  it('changes Color Scheme via the Select on the Style tab', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Style/ }))
    const triggers = screen.getAllByRole('combobox')
    // First combobox on the appearance tab is Color Scheme
    await user.click(triggers[0])
    await user.click(await screen.findByRole('option', { name: 'Minimal' }))
    expect(updatePreference).toHaveBeenCalledWith('colorScheme', 'minimal')
  })

  it('changes Card Style via the Select on the Style tab', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Style/ }))
    const triggers = screen.getAllByRole('combobox')
    await user.click(triggers[1])
    await user.click(await screen.findByRole('option', { name: 'Bordered' }))
    expect(updatePreference).toHaveBeenCalledWith('cardStyle', 'bordered')
  })

  it('changes Background Pattern via the Select', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Style/ }))
    const triggers = screen.getAllByRole('combobox')
    await user.click(triggers[2])
    await user.click(await screen.findByRole('option', { name: 'Waves' }))
    expect(updatePreference).toHaveBeenCalledWith('backgroundPattern', 'waves')
  })

  it('changes Chat Bubble Style via the Select', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Style/ }))
    const triggers = screen.getAllByRole('combobox')
    await user.click(triggers[3])
    await user.click(await screen.findByRole('option', { name: 'Sharp' }))
    expect(updatePreference).toHaveBeenCalledWith('chatBubbleStyle', 'sharp')
  })

  it('toggles Contextual Colors switch on the Style tab', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Style/ }))
    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])
    expect(updatePreference).toHaveBeenCalledWith('contextualColors', false)
  })

  it('changes Font Size via the Select on the Text tab', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Text/ }))
    const triggers = screen.getAllByRole('combobox')
    await user.click(triggers[0])
    await user.click(await screen.findByRole('option', { name: 'Large' }))
    expect(updatePreference).toHaveBeenCalledWith('fontSize', 'large')
  })

  it('changes Animation Intensity via the Select on the Effects tab', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('tab', { name: /Effects/ }))
    const triggers = screen.getAllByRole('combobox')
    await user.click(triggers[0])
    await user.click(await screen.findByRole('option', { name: 'Enhanced' }))
    expect(updatePreference).toHaveBeenCalledWith('animationIntensity', 'enhanced')
  })

  it('renders enhanced animation preview with rotate transform', async () => {
    mockUseDynamicUI.mockReturnValue({
      preferences: { ...defaultPreferences, animationIntensity: 'enhanced' as const },
      updatePreference,
      setPreferences,
    })
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)
    await user.click(screen.getByRole('tab', { name: /Effects/ }))
    expect(screen.getByText('Animation Preview')).toBeInTheDocument()
  })

  it('renders subtle animation preview', async () => {
    mockUseDynamicUI.mockReturnValue({
      preferences: { ...defaultPreferences, animationIntensity: 'subtle' as const },
      updatePreference,
      setPreferences,
    })
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)
    await user.click(screen.getByRole('tab', { name: /Effects/ }))
    expect(screen.getByText('Animation Preview')).toBeInTheDocument()
  })

  it('applies the Minimal preset', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('button', { name: 'Minimal' }))
    expect(setPreferences).toHaveBeenCalledTimes(1)
    const updater = setPreferences.mock.calls[0][0] as (
      p: typeof defaultPreferences,
    ) => typeof defaultPreferences
    const next = updater(defaultPreferences)
    expect(next.colorScheme).toBe('minimal')
    expect(toast.success).toHaveBeenCalledWith('Applied Minimal theme')
  })

  it('applies the High Contrast preset', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('button', { name: 'High Contrast' }))
    expect(setPreferences).toHaveBeenCalledTimes(1)
    const updater = setPreferences.mock.calls[0][0] as (
      p: typeof defaultPreferences,
    ) => typeof defaultPreferences
    const next = updater(defaultPreferences)
    expect(next.colorScheme).toBe('high-contrast')
    expect(toast.success).toHaveBeenCalledWith('Applied High Contrast theme')
  })

  it('applies the Default preset', async () => {
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('button', { name: 'Default' }))
    expect(setPreferences).toHaveBeenCalledTimes(1)
  })

  it('reset-to-defaults calls setPreferences with the full default object and toasts', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<DynamicUICustomizer />)

    await user.click(screen.getByRole('button', { name: /Reset to Defaults/ }))
    expect(setPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        layoutDensity: 'comfortable',
        colorScheme: 'default',
        cardStyle: 'elevated',
        animationIntensity: 'normal',
        autoAdaptLayout: true,
      }),
    )
    expect(toast.success).toHaveBeenCalledWith('Reset to default settings')
  })
})
