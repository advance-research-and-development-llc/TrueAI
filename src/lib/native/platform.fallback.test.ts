/**
 * Coverage for the try/catch fallback paths in `platform.ts`.
 *
 * The base `platform.test.ts` exercises the happy path under jsdom
 * where `Capacitor.*` returns the web defaults. This file mocks
 * `@capacitor/core` so that each `Capacitor.*` call throws, proving
 * the wrappers swallow the error and return the documented web-safe
 * fallback (`'web'`, `false`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => {
      throw new Error('platform unavailable')
    },
    isNativePlatform: () => {
      throw new Error('native check failed')
    },
    isPluginAvailable: () => {
      throw new Error('plugin probe failed')
    },
  },
}))

beforeEach(() => {
  vi.resetModules()
})

describe('native/platform (Capacitor throws)', () => {
  it('getPlatform falls back to "web" when Capacitor.getPlatform throws', async () => {
    const { getPlatform } = await import('./platform')
    expect(getPlatform()).toBe('web')
  })

  it('isNative falls back to false when Capacitor.isNativePlatform throws', async () => {
    const { isNative } = await import('./platform')
    expect(isNative()).toBe(false)
  })

  it('isAndroid / isIOS return false when getPlatform falls back to "web"', async () => {
    const { isAndroid, isIOS } = await import('./platform')
    expect(isAndroid()).toBe(false)
    expect(isIOS()).toBe(false)
  })

  it('isPluginAvailable returns false when Capacitor.isPluginAvailable throws', async () => {
    const { isPluginAvailable } = await import('./platform')
    expect(isPluginAvailable('Anything')).toBe(false)
  })
})
