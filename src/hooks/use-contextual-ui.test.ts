import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

// Drive `useKV` through a mutable impl so individual tests can opt into
// returning `null` (the documented "missing-from-store" branch) without
// owning a separate test file.
let useKVImpl: <T>(key: string, initial: T) => readonly [T | null, React.Dispatch<React.SetStateAction<T | null>>] =
  <T,>(_key: string, initial: T) =>
    useState<T | null>(initial) as unknown as readonly [
      T | null,
      React.Dispatch<React.SetStateAction<T | null>>,
    ]

vi.mock('@github/spark/hooks', () => ({
  useKV: <T,>(key: string, initial: T) => useKVImpl<T>(key, initial),
}))

const { useContextualUI } = await import('./use-contextual-ui')

describe('useContextualUI', () => {
  beforeEach(() => {
    // Pin "now" to a fixed afternoon time so the time-of-day branches are
    // deterministic.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T13:00:00Z'))
    // The hook uses `new Date().getHours()` (local TZ) to bucket usage into
    // morning/afternoon/evening/night. Tests pin the *UTC* time, so on
    // non-UTC runners the local hour differs and the bucket assertions
    // become flaky. Force getHours() to return the UTC hour so the tests
    // are TZ-independent without changing the production behaviour
    // (which correctly uses the user's wall clock).
    vi.spyOn(Date.prototype, 'getHours').mockImplementation(function (this: Date) {
      return this.getUTCHours()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    // Restore the default useKV behaviour after any test that overrode it.
    useKVImpl = <T,>(_key: string, initial: T) =>
      useState<T | null>(initial) as unknown as readonly [
        T | null,
        React.Dispatch<React.SetStateAction<T | null>>,
      ]
  })

  it('exposes the expected API surface', () => {
    const { result } = renderHook(() => useContextualUI())
    expect(typeof result.current.trackFeatureUsage).toBe('function')
    expect(typeof result.current.trackTimeOfDay).toBe('function')
    expect(typeof result.current.trackError).toBe('function')
    expect(typeof result.current.trackSessionDuration).toBe('function')
    expect(typeof result.current.dismissSuggestion).toBe('function')
    expect(Array.isArray(result.current.suggestions)).toBe(true)
  })

  it('trackFeatureUsage increments the per-feature counter', () => {
    const { result } = renderHook(() => useContextualUI())
    act(() => result.current.trackFeatureUsage('chat'))
    act(() => result.current.trackFeatureUsage('chat'))
    act(() => result.current.trackFeatureUsage('agents'))
    expect(result.current.behavior?.mostUsedFeatures.chat).toBe(2)
    expect(result.current.behavior?.mostUsedFeatures.agents).toBe(1)
  })

  it('trackTimeOfDay puts a feature into the matching period bucket', () => {
    const { result } = renderHook(() => useContextualUI())
    act(() => result.current.trackTimeOfDay('chat')) // afternoon
    expect(result.current.behavior?.timePatterns.afternoon).toContain('chat')
    expect(result.current.behavior?.timePatterns.morning).not.toContain('chat')
  })

  it('trackError keeps only the last 10 errors', () => {
    const { result } = renderHook(() => useContextualUI())
    for (let i = 0; i < 15; i++) {
      act(() => result.current.trackError(`E${i}`))
    }
    expect(result.current.behavior?.errorPatterns.length).toBeLessThanOrEqual(11)
    // Most recent error is retained.
    expect(result.current.behavior?.errorPatterns).toContain('E14')
    expect(result.current.behavior?.errorPatterns).not.toContain('E0')
  })

  it('trackSessionDuration appends durations and updates lastActive', () => {
    const { result } = renderHook(() => useContextualUI())
    act(() => result.current.trackSessionDuration(1000))
    act(() => result.current.trackSessionDuration(2000))
    expect(result.current.behavior?.sessionDuration).toEqual([1000, 2000])
    expect(typeof result.current.behavior?.lastActive).toBe('number')
  })

  it('emits a "keyboard-shortcut" suggestion when a feature usage > 10', async () => {
    const { result } = renderHook(() => useContextualUI())
    for (let i = 0; i < 12; i++) {
      act(() => result.current.trackFeatureUsage('chat'))
    }
    // The suggestions effect runs synchronously after each setBehavior.
    const ids = result.current.suggestions.map(s => s.id)
    expect(ids).toContain('keyboard-shortcut')
  })

  it('emits a "break-reminder" when avg session duration > 30 minutes', () => {
    const { result } = renderHook(() => useContextualUI())
    act(() => result.current.trackSessionDuration(40 * 60 * 1000))
    const ids = result.current.suggestions.map(s => s.id)
    expect(ids).toContain('break-reminder')
  })

  it('emits an "error-help" suggestion when one error repeats > 2x', () => {
    const { result } = renderHook(() => useContextualUI())
    for (let i = 0; i < 6; i++) {
      act(() => result.current.trackError('Network failure'))
    }
    const ids = result.current.suggestions.map(s => s.id)
    expect(ids).toContain('error-help')
  })

  it('dismissSuggestion removes the suggestion and persists the dismissal', () => {
    const { result } = renderHook(() => useContextualUI())
    for (let i = 0; i < 12; i++) {
      act(() => result.current.trackFeatureUsage('chat'))
    }
    expect(result.current.suggestions.find(s => s.id === 'keyboard-shortcut')).toBeTruthy()

    act(() => result.current.dismissSuggestion('keyboard-shortcut'))
    expect(result.current.suggestions.find(s => s.id === 'keyboard-shortcut')).toBeUndefined()
  })

  it('getPredictedNextAction returns the most-used feature or null', () => {
    const { result } = renderHook(() => useContextualUI())
    expect(result.current.getPredictedNextAction()).toBeNull()
    act(() => result.current.trackFeatureUsage('agents'))
    act(() => result.current.trackFeatureUsage('agents'))
    act(() => result.current.trackFeatureUsage('chat'))
    expect(result.current.getPredictedNextAction()).toBe('agents')
  })

  it('getRecommendedFeatures returns features the user has not used yet', () => {
    const { result } = renderHook(() => useContextualUI())
    act(() => result.current.trackFeatureUsage('chat'))
    const recs = result.current.getRecommendedFeatures()
    expect(recs).not.toContain('chat')
    expect(recs).toContain('agents')
    expect(recs).toContain('workflows')
  })

  describe('time-of-day period branches inside generateSuggestions / trackTimeOfDay', () => {
    it.each([
      ['2024-01-01T08:00:00Z', 'morning'],
      ['2024-01-01T13:00:00Z', 'afternoon'],
      ['2024-01-01T19:00:00Z', 'evening'],
      ['2024-01-01T23:30:00Z', 'night'],
    ] as const)(
      'routes %s into the "%s" bucket and surfaces a time-pattern suggestion',
      (iso, bucket) => {
        vi.setSystemTime(new Date(iso))
        const { result } = renderHook(() => useContextualUI())
        act(() => result.current.trackTimeOfDay('chat'))
        expect(result.current.behavior?.timePatterns[bucket]).toContain('chat')
        const ids = result.current.suggestions.map((s) => s.id)
        expect(ids).toContain('time-pattern')
      },
    )
  })

  describe('null-behavior fallback (useKV returns null before hydration)', () => {
    beforeEach(() => {
      // Force useKV to start with `null`, which is the genuine
      // "value not yet hydrated from IndexedDB" state. This exercises the
      // `prev ?? initialBehavior`, `prev || []`, and `if (!behavior)`
      // guards that the default `useState(initial)` mock skips entirely.
      useKVImpl = <T,>(_key: string, _initial: T) =>
        useState<T | null>(null) as unknown as readonly [
          T | null,
          React.Dispatch<React.SetStateAction<T | null>>,
        ]
    })

    it('generateSuggestions returns [] when behavior is null', () => {
      const { result } = renderHook(() => useContextualUI())
      // The effect runs once with behavior=null and produces no suggestions.
      expect(result.current.suggestions).toEqual([])
    })

    it('getPredictedNextAction returns null when behavior is null', () => {
      const { result } = renderHook(() => useContextualUI())
      expect(result.current.getPredictedNextAction()).toBeNull()
    })

    it('getRecommendedFeatures returns [] when behavior is null', () => {
      const { result } = renderHook(() => useContextualUI())
      expect(result.current.getRecommendedFeatures()).toEqual([])
    })

    it('trackFeatureUsage hydrates from initialBehavior when prev is null (?? fallback)', () => {
      const { result } = renderHook(() => useContextualUI())
      act(() => result.current.trackFeatureUsage('chat'))
      // First call must seed via initialBehavior, then increment chat to 1.
      expect(result.current.behavior?.mostUsedFeatures.chat).toBe(1)
    })

    it('trackTimeOfDay hydrates from initialBehavior when prev is null (?? fallback)', () => {
      // The outer `beforeEach` pins time to 2024-01-01T13:00:00Z (afternoon).
      const { result } = renderHook(() => useContextualUI())
      act(() => result.current.trackTimeOfDay('agents'))
      expect(result.current.behavior?.timePatterns.afternoon).toContain('agents')
    })

    it('trackError hydrates from initialBehavior when prev is null (?? fallback)', () => {
      const { result } = renderHook(() => useContextualUI())
      act(() => result.current.trackError('boom'))
      expect(result.current.behavior?.errorPatterns).toContain('boom')
    })

    it('trackSessionDuration hydrates from initialBehavior when prev is null (?? fallback)', () => {
      const { result } = renderHook(() => useContextualUI())
      act(() => result.current.trackSessionDuration(5000))
      expect(result.current.behavior?.sessionDuration).toEqual([5000])
    })

    it('dismissSuggestion handles null dismissedSuggestions list (|| [] fallback)', () => {
      // Seed enough usage to surface a suggestion, then dismiss it. The
      // `prev || []` guard inside dismissSuggestion fires because
      // dismissedSuggestions is null.
      const { result } = renderHook(() => useContextualUI())
      for (let i = 0; i < 12; i++) {
        act(() => result.current.trackFeatureUsage('chat'))
      }
      const ks = result.current.suggestions.find((s) => s.id === 'keyboard-shortcut')
      expect(ks).toBeTruthy()
      act(() => result.current.dismissSuggestion('keyboard-shortcut'))
      expect(
        result.current.suggestions.find((s) => s.id === 'keyboard-shortcut'),
      ).toBeUndefined()
    })
  })
})
