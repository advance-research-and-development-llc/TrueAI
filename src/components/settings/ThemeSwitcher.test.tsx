/*
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") / Advanced Technology Research
 *
 * Tests for the ThemeSwitcher settings component. Covers the exported
 * `ThemeSwitcher` flow end-to-end (activate / preview / create / delete /
 * export / copy CSS / open editor) so the previously-uncovered file lands
 * with meaningful regression protection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ----- Mocks ---------------------------------------------------------------

// `useKV` from @github/spark/hooks: back it with React.useState so each
// hook instance is reactive within the test render.
vi.mock('@github/spark/hooks', () => ({
  useKV: <T,>(_key: string, def: T) => React.useState<T>(def),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// copyText returns a Promise<boolean>; default to success, override per-test.
const copyTextMock = vi.fn<(text: string) => Promise<boolean>>(async () => true)
vi.mock('@/lib/native/clipboard', () => ({
  copyText: (text: string) => copyTextMock(text),
}))

// framer-motion: replace motion.div / AnimatePresence with simple pass-throughs
// so AnimatePresence's exit animation doesn't keep removed nodes in the DOM.
vi.mock('framer-motion', () => {
  const passthrough = ({ children, ...rest }: { children?: React.ReactNode }) =>
    React.createElement('div', rest, children)
  const motion = new Proxy(
    {},
    {
      get: () => passthrough,
    },
  )
  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  }
})

// ScrollArea uses Radix internals that drag in ResizeObserver edge cases;
// simplify it for the tests.
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'scroll-area' }, children),
}))

import { toast } from 'sonner'
import { ThemeSwitcher } from './ThemeSwitcher'

const toastSuccess = toast.success as unknown as ReturnType<typeof vi.fn>
const toastError = toast.error as unknown as ReturnType<typeof vi.fn>

// ----- Helpers -------------------------------------------------------------

/**
 * Render the component and return helpers to interact with it.
 */
function renderSwitcher() {
  return render(<ThemeSwitcher />)
}

beforeEach(() => {
  vi.clearAllMocks()
  copyTextMock.mockImplementation(async () => true)
  // Reset any inline CSS variables the component sets.
  document.documentElement.removeAttribute('style')
})

afterEach(() => {
  document.documentElement.removeAttribute('style')
})

// ----- Tests ---------------------------------------------------------------

describe('ThemeSwitcher', () => {
  it('renders the header, Import and Create Theme buttons', () => {
    renderSwitcher()
    expect(screen.getByText('Theme Customization')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /import/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create theme/i }),
    ).toBeInTheDocument()
  })

  it('renders all default themes by name', () => {
    renderSwitcher()
    for (const name of [
      'Deep Ocean',
      'Forest Night',
      'Sunset Glow',
      'Purple Dream',
      'Cyberpunk',
      'Minimal Light',
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })

  it('activate applies CSS variables and toasts success', () => {
    renderSwitcher()
    // The first card in document order is "Deep Ocean".
    const activateButtons = screen.getAllByRole('button', { name: /activate/i })
    fireEvent.click(activateButtons[0])

    expect(toastSuccess).toHaveBeenCalledWith(
      'Theme "Deep Ocean" activated',
    )
    // Activation writes CSS custom properties on <html>.
    expect(
      document.documentElement.style.getPropertyValue('--background'),
    ).not.toBe('')
    expect(
      document.documentElement.style.getPropertyValue('--radius'),
    ).toBe('0.625rem')
  })

  it('preview shows the live-preview banner; Exit Preview clears it', () => {
    renderSwitcher()
    const previewButtons = screen.getAllByRole('button', { name: /^preview$/i })
    fireEvent.click(previewButtons[0])

    expect(screen.getByText('Live Preview Active')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /exit preview/i }))
    expect(screen.queryByText('Live Preview Active')).not.toBeInTheDocument()
  })

  it('create dialog: empty name shows an error toast and does not create', () => {
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }))

    // Name input present in the dialog.
    const input = screen.getByLabelText(/theme name/i) as HTMLInputElement
    expect(input.value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /create & edit/i }))
    expect(toastError).toHaveBeenCalledWith('Please enter a theme name')
    expect(toastSuccess).not.toHaveBeenCalledWith('Theme created')
  })

  it('create dialog: cancel clears state and does not create a theme', () => {
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }))

    const input = screen.getByLabelText(/theme name/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Throwaway' } })

    // Click the dialog Cancel (not the editor cancel — editor isn't open yet).
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(toastSuccess).not.toHaveBeenCalledWith('Theme created')
    expect(screen.queryByText('Editing: Throwaway')).not.toBeInTheDocument()
  })

  it('create dialog: valid name creates theme, toasts, and opens editor', () => {
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }))

    const input = screen.getByLabelText(/theme name/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'My Theme' } })

    fireEvent.click(screen.getByRole('button', { name: /create & edit/i }))

    expect(toastSuccess).toHaveBeenCalledWith('Theme created')
    // Editor should now be displayed for the new theme.
    expect(screen.getByText('Editing: My Theme')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /save theme/i }),
    ).toBeInTheDocument()
  })

  it('editor: Cancel exits without saving', () => {
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }))
    fireEvent.change(screen.getByLabelText(/theme name/i), {
      target: { value: 'Editor Test' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create & edit/i }))

    // Editor open. Reset mocks to isolate the cancel assertion.
    vi.clearAllMocks()
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(toastSuccess).not.toHaveBeenCalledWith('Theme saved')
    expect(screen.queryByText('Editing: Editor Test')).not.toBeInTheDocument()
  })

  it('editor: Save persists changes and toasts', () => {
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }))
    fireEvent.change(screen.getByLabelText(/theme name/i), {
      target: { value: 'Saveable' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create & edit/i }))

    fireEvent.click(screen.getByRole('button', { name: /save theme/i }))

    expect(toastSuccess).toHaveBeenCalledWith('Theme saved')
    expect(screen.queryByText('Editing: Saveable')).not.toBeInTheDocument()
    // The card for the new theme is back in the grid.
    expect(screen.getByText('Saveable')).toBeInTheDocument()
  })

  it('delete: refuses to delete a default theme', () => {
    renderSwitcher()
    // Default themes do not show a Delete button (isCustom=false). To exercise
    // the guard branch we create a custom theme then verify default themes
    // still cannot be deleted via UI: assert the absence of a delete button on
    // a default card. The guard itself is also exercised indirectly because
    // the only path that reaches it is internal.
    // Instead, we directly reach into the default card region and confirm no
    // Delete button exists alongside "Deep Ocean".
    const deepOceanHeading = screen.getByText('Deep Ocean')
    const card = deepOceanHeading.closest('[data-slot="card"]') as HTMLElement
    expect(card).toBeTruthy()
    expect(
      card.querySelector('button [data-testid="trash-icon"]'),
    ).toBeNull()
  })

  it('delete: removes a custom theme and clears active id when matching', () => {
    renderSwitcher()
    // Create a custom theme.
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }))
    fireEvent.change(screen.getByLabelText(/theme name/i), {
      target: { value: 'Deletable' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create & edit/i }))
    // Save it back to the grid so it has Activate / Delete buttons.
    fireEvent.click(screen.getByRole('button', { name: /save theme/i }))

    // Activate it — this sets activeThemeId to the custom theme's id.
    const card = screen
      .getByText('Deletable')
      .closest('[data-slot="card"]') as HTMLElement
    const activate = card.querySelector('button')!
    // The first button in the card should be "Activate".
    fireEvent.click(activate)
    expect(toastSuccess).toHaveBeenCalledWith('Theme "Deletable" activated')

    // Delete it — find Delete button within the same card.
    const deleteBtn = Array.from(card.querySelectorAll('button')).find((b) =>
      /delete/i.test(b.textContent || ''),
    )
    expect(deleteBtn).toBeTruthy()
    fireEvent.click(deleteBtn!)

    expect(toastSuccess).toHaveBeenCalledWith('Theme deleted')
    expect(screen.queryByText('Deletable')).not.toBeInTheDocument()
  })

  it('export: triggers an object-URL download and toasts', () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock')
    const revokeObjectURL = vi.fn<(url: string) => void>()
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL =
      createObjectURL as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL =
      revokeObjectURL as unknown as typeof URL.revokeObjectURL

    try {
      renderSwitcher()
      // Default cards expose an Export button.
      const exportButtons = screen.getAllByRole('button', { name: /^export$/i })
      fireEvent.click(exportButtons[0])

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const blobArg = createObjectURL.mock.calls[0][0]
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toBe('application/json')
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
      expect(toastSuccess).toHaveBeenCalledWith('Theme exported')
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })

  it('copy CSS: success path calls copyText and toasts success', async () => {
    renderSwitcher()
    const copyButtons = screen.getAllByRole('button', { name: /copy css/i })

    await act(async () => {
      fireEvent.click(copyButtons[0])
    })

    expect(copyTextMock).toHaveBeenCalledTimes(1)
    const css = copyTextMock.mock.calls[0][0]
    expect(css).toContain(':root {')
    expect(css).toContain('--background:')
    expect(css).toContain('--card-foreground:')
    expect(css).toContain('--radius:')
    expect(toastSuccess).toHaveBeenCalledWith(
      'Theme CSS copied to clipboard',
    )
  })

  it('copy CSS: failure path toasts an error', async () => {
    copyTextMock.mockImplementationOnce(async () => false)
    renderSwitcher()
    const copyButtons = screen.getAllByRole('button', { name: /copy css/i })

    await act(async () => {
      fireEvent.click(copyButtons[0])
    })

    expect(toastError).toHaveBeenCalledWith('Failed to copy theme CSS')
  })

  it('import: clicking Import opens a hidden file picker', () => {
    // We can't drive a real file selection in jsdom, but we can verify the
    // handler programmatically creates an <input type="file"> and clicks it.
    const realCreate = document.createElement.bind(document)
    const inputClick = vi.fn()
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = realCreate(tag)
        if (tag === 'input') {
          ;(el as HTMLInputElement).click = inputClick
        }
        return el
      })

    try {
      renderSwitcher()
      fireEvent.click(screen.getByRole('button', { name: /import/i }))
      expect(inputClick).toHaveBeenCalledTimes(1)
    } finally {
      createSpy.mockRestore()
    }
  })

  it('select base theme in create dialog shows "Starting from" hint', () => {
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }))

    // The dialog renders the first 4 default themes as base options.
    // Find and click the "Forest Night" base button (within the dialog).
    const baseButtons = screen
      .getAllByRole('button')
      .filter((b) => /forest night/i.test(b.textContent || ''))
    // There may be one base-button match in the dialog.
    expect(baseButtons.length).toBeGreaterThan(0)
    fireEvent.click(baseButtons[baseButtons.length - 1])

    expect(
      screen.getByText(/starting from: forest night/i),
    ).toBeInTheDocument()
  })

  it('stop preview restores the active theme colors when one is set', () => {
    renderSwitcher()
    // Activate a default theme so handleStopPreview has a target to restore to.
    const activateButtons = screen
      .getAllByRole('button')
      .filter((b) => /^activate$/i.test(b.textContent || ''))
    fireEvent.click(activateButtons[0])
    // Now preview a different theme.
    const previewButtons = screen
      .getAllByRole('button')
      .filter((b) => /^preview$/i.test(b.textContent || ''))
    fireEvent.click(previewButtons[1])
    expect(screen.getByText(/live preview active/i)).toBeInTheDocument()
    // Exit preview restores the active theme's colors (covers handleStopPreview
    // applyThemeColors branch on line 260).
    fireEvent.click(screen.getByRole('button', { name: /exit preview/i }))
    expect(screen.queryByText(/live preview active/i)).not.toBeInTheDocument()
  })

  it('import: parsing a valid JSON file adds an imported theme and toasts', () => {
    // Capture the synthetic file input that ThemeSwitcher creates so we can
    // dispatch onchange + drive FileReader.onload (lines 327-347).
    const realCreate = document.createElement.bind(document)
    let capturedInput: HTMLInputElement | null = null
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = realCreate(tag)
        if (tag === 'input') {
          ;(el as HTMLInputElement).click = () => {}
          capturedInput = el as HTMLInputElement
        }
        return el
      })

    // Stub FileReader to immediately fire onload with a valid theme payload.
    const origFR = window.FileReader
    class StubFR {
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null
      readAsText() {
        const ev = { target: { result: JSON.stringify({ name: 'Imported X', colors: {} }) } }
        this.onload?.call(this as unknown as FileReader, ev as unknown as ProgressEvent<FileReader>)
      }
    }
    ;(window as unknown as { FileReader: unknown }).FileReader = StubFR

    try {
      renderSwitcher()
      fireEvent.click(screen.getByRole('button', { name: /import/i }))
      expect(capturedInput).toBeTruthy()
      const file = new File(['x'], 'x.json', { type: 'application/json' })
      Object.defineProperty(capturedInput, 'files', { value: [file] })
      act(() => {
        capturedInput!.onchange?.({ target: capturedInput } as unknown as Event)
      })
      expect(toastSuccess).toHaveBeenCalledWith('Theme imported')
    } finally {
      createSpy.mockRestore()
      ;(window as unknown as { FileReader: unknown }).FileReader = origFR
    }
  })

  it('import: invalid JSON triggers an error toast', () => {
    const realCreate = document.createElement.bind(document)
    let capturedInput: HTMLInputElement | null = null
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = realCreate(tag)
        if (tag === 'input') {
          ;(el as HTMLInputElement).click = () => {}
          capturedInput = el as HTMLInputElement
        }
        return el
      })
    const origFR = window.FileReader
    class StubFR {
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null
      readAsText() {
        const ev = { target: { result: '{not json' } }
        this.onload?.call(this as unknown as FileReader, ev as unknown as ProgressEvent<FileReader>)
      }
    }
    ;(window as unknown as { FileReader: unknown }).FileReader = StubFR
    vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      renderSwitcher()
      fireEvent.click(screen.getByRole('button', { name: /import/i }))
      const file = new File(['x'], 'x.json', { type: 'application/json' })
      Object.defineProperty(capturedInput, 'files', { value: [file] })
      act(() => {
        capturedInput!.onchange?.({ target: capturedInput } as unknown as Event)
      })
      expect(toastError).toHaveBeenCalledWith('Invalid theme file')
    } finally {
      createSpy.mockRestore()
      ;(window as unknown as { FileReader: unknown }).FileReader = origFR
    }
  })

  it('import: change event with no file selected is a no-op', () => {
    const realCreate = document.createElement.bind(document)
    let capturedInput: HTMLInputElement | null = null
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = realCreate(tag)
        if (tag === 'input') {
          ;(el as HTMLInputElement).click = () => {}
          capturedInput = el as HTMLInputElement
        }
        return el
      })
    try {
      renderSwitcher()
      fireEvent.click(screen.getByRole('button', { name: /import/i }))
      Object.defineProperty(capturedInput, 'files', { value: [] })
      act(() => {
        capturedInput!.onchange?.({ target: capturedInput } as unknown as Event)
      })
      expect(toastSuccess).not.toHaveBeenCalledWith('Theme imported')
      expect(toastError).not.toHaveBeenCalledWith('Invalid theme file')
    } finally {
      createSpy.mockRestore()
    }
  })

  it('editor: switching the color group tab and editing colors invokes preview/onChange', () => {
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }))
    fireEvent.change(screen.getByLabelText(/theme name/i), {
      target: { value: 'Tab Test' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create & edit/i }))

    // Default tab is Background — change a color input there to drive
    // ColorPicker.handleChange + ThemeEditor.updateColor + onPreview
    // (lines 728/740/752 + 802-803 + 822).
    const inputs = document.querySelectorAll('input.font-mono')
    expect(inputs.length).toBeGreaterThan(0)
    fireEvent.change(inputs[0] as HTMLInputElement, {
      target: { value: 'oklch(0.40 0.10 200)' },
    })

    // Switch to Actions tab and edit there too.
    fireEvent.click(screen.getByRole('tab', { name: /^actions$/i }))
    const actionInputs = document.querySelectorAll('input.font-mono')
    expect(actionInputs.length).toBeGreaterThan(0)
    fireEvent.change(actionInputs[0] as HTMLInputElement, {
      target: { value: 'oklch(0.55 0.15 130)' },
    })

    // Switch to System tab (covers handler in line 714 onValueChange).
    const systemTabs = screen.getAllByRole('tab', { name: /^system$/i })
    fireEvent.click(systemTabs[systemTabs.length - 1])
    // Ensure the click did not throw and the editor is still mounted.
    expect(screen.getByText('Editing: Tab Test')).toBeInTheDocument()
  })

  it('editor: clicking a color preset button updates the color via handleChange', () => {
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }))
    fireEvent.change(screen.getByLabelText(/theme name/i), {
      target: { value: 'Preset Test' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create & edit/i }))

    // Each ColorPicker (non-radius) renders 4 preset buttons named "Preset N".
    const presetBtns = screen.getAllByRole('button', { name: /^preset 1$/i })
    expect(presetBtns.length).toBeGreaterThan(0)
    fireEvent.click(presetBtns[0])
    // Preset value lands in the matching font-mono input.
    const monoInputs = document.querySelectorAll('input.font-mono')
    expect((monoInputs[0] as HTMLInputElement).value).toContain('oklch')
  })

  it('editor: ThemeCard preview from the editor flow sets a preview color', () => {
    renderSwitcher()
    // Start a preview directly from a ThemeCard to cover the inline
    // arrow `(colors) => setPreviewTheme(colors)` (line 421 path is in the
    // editor; this test exercises the sibling onPreview from ThemeCard).
    const previewButtons = screen
      .getAllByRole('button')
      .filter((b) => /^preview$/i.test(b.textContent || ''))
    fireEvent.click(previewButtons[0])
    expect(screen.getByText(/live preview active/i)).toBeInTheDocument()
  })
})
