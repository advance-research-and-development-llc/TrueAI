import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { PerformanceProfileManager } from './PerformanceProfileManager'
import type { ModelParameters, PerformanceProfile, TaskType } from '@/lib/types'
import userEvent from '@testing-library/user-event'

// Radix Select requires pointer-capture stubs in jsdom
beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false
    HTMLElement.prototype.setPointerCapture = () => {}
    HTMLElement.prototype.releasePointerCapture = () => {}
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {}
  }
})

const mockParams: ModelParameters = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
}

const mockProfile: PerformanceProfile = {
  id: 'p1',
  name: 'My Profile',
  description: 'A test profile description',
  taskType: 'conversation' as TaskType,
  parameters: mockParams,
  usageCount: 3,
  createdAt: new Date().toISOString(),
  reasoning: 'Balanced settings for chat',
}

const defaultProps = {
  profiles: [],
  currentModelParams: mockParams,
  currentModelId: 'model-1',
  onCreateProfile: vi.fn(),
  onApplyProfile: vi.fn(),
  onDeleteProfile: vi.fn(),
  onAutoTune: vi.fn(),
}

describe('PerformanceProfileManager', () => {
  it('renders heading', () => {
    render(<PerformanceProfileManager {...defaultProps} />)
    expect(screen.getByText('Performance Profiles')).toBeInTheDocument()
  })

  it('renders without crashing with no profiles', () => {
    render(<PerformanceProfileManager {...defaultProps} />)
    expect(document.body).toBeTruthy()
  })

  it('renders without crashing', () => {
    render(<PerformanceProfileManager {...defaultProps} />)
    expect(document.body).toBeTruthy()
  })

  it('shows match score percentage for current params', () => {
    render(<PerformanceProfileManager {...defaultProps} />)
    // Some percentage value should be visible
    expect(screen.getByText(/%/)).toBeInTheDocument()
  })

  it('opens recommendations dialog on Get Recommendations click', async () => {
    const user = userEvent.setup()
    render(<PerformanceProfileManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /get recommendations/i }))
    expect(screen.getByText('Auto-Tune Recommendations')).toBeInTheDocument()
  })

  it('calls onAutoTune and closes dialog on Apply Recommendations', async () => {
    const user = userEvent.setup()
    const onAutoTune = vi.fn()
    render(<PerformanceProfileManager {...defaultProps} onAutoTune={onAutoTune} />)
    await user.click(screen.getByRole('button', { name: /get recommendations/i }))
    await user.click(screen.getByRole('button', { name: /apply recommendations/i }))
    expect(onAutoTune).toHaveBeenCalledWith('conversation')
    expect(screen.queryByText('Auto-Tune Recommendations')).not.toBeInTheDocument()
  })

  it('closes recommendations dialog on Cancel', async () => {
    const user = userEvent.setup()
    render(<PerformanceProfileManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /get recommendations/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText('Auto-Tune Recommendations')).not.toBeInTheDocument()
  })

  it('opens Create Profile dialog', async () => {
    const user = userEvent.setup()
    render(<PerformanceProfileManager {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /create profile/i }))
    expect(screen.getByText('Create Performance Profile')).toBeInTheDocument()
  })

  it('calls onCreateProfile and closes dialog on Create Profile confirm', async () => {
    const user = userEvent.setup()
    const onCreateProfile = vi.fn()
    render(<PerformanceProfileManager {...defaultProps} onCreateProfile={onCreateProfile} />)
    await user.click(screen.getByRole('button', { name: /create profile/i }))
    // click the dialog's "Create Profile" confirm button
    const buttons = screen.getAllByRole('button', { name: /create profile/i })
    // The second button is inside the dialog footer
    await user.click(buttons[buttons.length - 1])
    expect(onCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ taskType: 'conversation', usageCount: 0 })
    )
  })

  it('renders saved profiles list', () => {
    render(<PerformanceProfileManager {...defaultProps} profiles={[mockProfile]} />)
    expect(screen.getByText('My Profile')).toBeInTheDocument()
    expect(screen.getByText('Used 3 times')).toBeInTheDocument()
  })

  it('calls onApplyProfile from profile list Apply button', async () => {
    const user = userEvent.setup()
    const onApplyProfile = vi.fn()
    render(<PerformanceProfileManager {...defaultProps} profiles={[mockProfile]} onApplyProfile={onApplyProfile} />)
    await user.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApplyProfile).toHaveBeenCalledWith(mockProfile)
  })

  it('opens profile dialog on profile card click', async () => {
    const user = userEvent.setup()
    render(<PerformanceProfileManager {...defaultProps} profiles={[mockProfile]} />)
    await user.click(screen.getByText('My Profile'))
    // description appears in both the card and the dialog - use the dialog role
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
  })

  it('calls onDeleteProfile from profile dialog Delete button', async () => {
    const user = userEvent.setup()
    const onDeleteProfile = vi.fn()
    render(<PerformanceProfileManager {...defaultProps} profiles={[mockProfile]} onDeleteProfile={onDeleteProfile} />)
    await user.click(screen.getByText('My Profile'))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onDeleteProfile).toHaveBeenCalledWith('p1')
  })

  it('calls onApplyProfile from profile dialog Apply Profile button', async () => {
    const user = userEvent.setup()
    const onApplyProfile = vi.fn()
    render(<PerformanceProfileManager {...defaultProps} profiles={[mockProfile]} onApplyProfile={onApplyProfile} />)
    await user.click(screen.getByText('My Profile'))
    await user.click(screen.getByRole('button', { name: /^apply profile$/i }))
    expect(onApplyProfile).toHaveBeenCalledWith(mockProfile)
  })

  it('changing the main Task Type Select updates the visible Task Type label', async () => {
    const user = userEvent.setup()
    render(<PerformanceProfileManager {...defaultProps} />)
    // Main view Select is the first combobox.
    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(await screen.findByRole('option', { name: /code generation/i }))
    // Visible state of the trigger reflects the new selection.
    const triggers = screen.getAllByRole('combobox')
    expect(triggers[0]).toHaveTextContent(/code generation/i)
  })

  it('changing the Create-dialog Task Type Select feeds onCreateProfile with the new taskType', async () => {
    const user = userEvent.setup()
    const onCreateProfile = vi.fn()
    render(<PerformanceProfileManager {...defaultProps} onCreateProfile={onCreateProfile} />)
    await user.click(screen.getByRole('button', { name: /create profile/i }))
    // The dialog's Select is the second visible combobox.
    const triggers = screen.getAllByRole('combobox')
    await user.click(triggers[triggers.length - 1])
    await user.click(await screen.findByRole('option', { name: /code generation/i }))
    const buttons = screen.getAllByRole('button', { name: /create profile/i })
    await user.click(buttons[buttons.length - 1])
    expect(onCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ taskType: 'code_generation' }),
    )
  })

  it('Cancel button in Create Profile dialog closes the dialog without invoking onCreateProfile', async () => {
    const user = userEvent.setup()
    const onCreateProfile = vi.fn()
    render(<PerformanceProfileManager {...defaultProps} onCreateProfile={onCreateProfile} />)
    await user.click(screen.getByRole('button', { name: /create profile/i }))
    expect(screen.getByText('Create Performance Profile')).toBeInTheDocument()
    // Cancel — the second cancel button (recommendations dialog isn't open here).
    const cancels = screen.getAllByRole('button', { name: /^cancel$/i })
    await user.click(cancels[cancels.length - 1])
    expect(screen.queryByText('Create Performance Profile')).not.toBeInTheDocument()
    expect(onCreateProfile).not.toHaveBeenCalled()
  })

  it('viewingProfile dialog closes via onOpenChange (Escape)', async () => {
    const user = userEvent.setup()
    render(<PerformanceProfileManager {...defaultProps} profiles={[mockProfile]} />)
    await user.click(screen.getByText('My Profile'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Close via Escape — Radix Dialog routes this through onOpenChange,
    // which in turn calls setViewingProfile(null).
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows Excellent Match label/green color when params match conversation defaults exactly', () => {
    const idealParams: ModelParameters = {
      temperature: 0.7, maxTokens: 1500, topP: 0.9,
      frequencyPenalty: 0.2, presencePenalty: 0.3,
    }
    render(<PerformanceProfileManager {...defaultProps} currentModelParams={idealParams} />)
    const label = screen.getByText('Excellent Match')
    expect(label).toBeInTheDocument()
    expect(label.className).toContain('text-green-500')
  })

  it('shows Fair Match label when params are moderately off', () => {
    const fairParams: ModelParameters = {
      temperature: 0.5, maxTokens: 2500, topP: 0.7,
      frequencyPenalty: 0.7, presencePenalty: 0.8,
    }
    render(<PerformanceProfileManager {...defaultProps} currentModelParams={fairParams} />)
    expect(screen.getByText('Fair Match')).toBeInTheDocument()
  })

  it('shows Poor Match label/orange color when params are wildly off', () => {
    const poorParams: ModelParameters = {
      temperature: 1.7, maxTokens: 4500, topP: 0.4,
      frequencyPenalty: 1.2, presencePenalty: 1.3,
    }
    render(<PerformanceProfileManager {...defaultProps} currentModelParams={poorParams} />)
    const label = screen.getByText('Poor Match')
    expect(label).toBeInTheDocument()
    expect(label.className).toContain('text-orange-500')
  })
})
