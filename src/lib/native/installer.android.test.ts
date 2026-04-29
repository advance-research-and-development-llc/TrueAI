/**
 * Tests for the Android paths of `getInstallerSource` that the existing
 * `installer.test.ts` cannot exercise (the latter only runs the web
 * fast-path because jsdom is not a "native" platform).
 *
 * We mock `./platform` to look native+Android and `@capacitor/app` to
 * provide a controllable `App.getInfo` result, then re-import the
 * module under test with `vi.resetModules()` so the lazy
 * `await import('@capacitor/app')` inside `getInstallerSource` picks
 * up the mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./platform', () => ({
  isNative: () => true,
  isAndroid: () => true,
}))

const getInfoMock = vi.fn()

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: (...args: unknown[]) => getInfoMock(...args),
  },
}))

beforeEach(() => {
  getInfoMock.mockReset()
  vi.resetModules()
})

describe('native/installer (Android paths)', () => {
  it('classifies F-Droid installer package as "fdroid"', async () => {
    getInfoMock.mockResolvedValue({ installerPackageName: 'org.fdroid.fdroid' })
    const { getInstallerSource } = await import('./installer')
    await expect(getInstallerSource()).resolves.toBe('fdroid')
  })

  it('classifies the Play Store installer as "play"', async () => {
    getInfoMock.mockResolvedValue({ installerPackageName: 'com.android.vending' })
    const { getInstallerSource } = await import('./installer')
    await expect(getInstallerSource()).resolves.toBe('play')
  })

  it('classifies missing installerPackageName as "sideload"', async () => {
    getInfoMock.mockResolvedValue({ installerPackageName: null })
    const { getInstallerSource } = await import('./installer')
    await expect(getInstallerSource()).resolves.toBe('sideload')
  })

  it('classifies an unknown installer id as "sideload"', async () => {
    getInfoMock.mockResolvedValue({
      installerPackageName: 'com.example.some.other.store',
    })
    const { getInstallerSource } = await import('./installer')
    await expect(getInstallerSource()).resolves.toBe('sideload')
  })

  it('returns "unknown" when App.getInfo throws', async () => {
    getInfoMock.mockRejectedValue(new Error('plugin unavailable'))
    const { getInstallerSource } = await import('./installer')
    await expect(getInstallerSource()).resolves.toBe('unknown')
  })

  it('isInstalledFromFDroid is true when the installer is the F-Droid client', async () => {
    getInfoMock.mockResolvedValue({
      installerPackageName: 'org.fdroid.fdroid.privileged',
    })
    const { isInstalledFromFDroid } = await import('./installer')
    await expect(isInstalledFromFDroid()).resolves.toBe(true)
  })

  it('isInstalledFromFDroid is false when installed from Play Store', async () => {
    getInfoMock.mockResolvedValue({ installerPackageName: 'com.android.vending' })
    const { isInstalledFromFDroid } = await import('./installer')
    await expect(isInstalledFromFDroid()).resolves.toBe(false)
  })
})

describe('native/installer (Android paths, getInfo missing)', () => {
  it('returns "unknown" when @capacitor/app exposes no getInfo function', async () => {
    vi.resetModules()
    vi.doMock('./platform', () => ({
      isNative: () => true,
      isAndroid: () => true,
    }))
    vi.doMock('@capacitor/app', () => ({ App: {} }))
    const { getInstallerSource } = await import('./installer')
    await expect(getInstallerSource()).resolves.toBe('unknown')
  })
})

describe('native/installer (non-Android native, e.g. iOS)', () => {
  it('returns "unknown" when running on a non-Android native platform', async () => {
    vi.resetModules()
    vi.doMock('./platform', () => ({
      isNative: () => true,
      isAndroid: () => false,
    }))
    const { getInstallerSource } = await import('./installer')
    await expect(getInstallerSource()).resolves.toBe('unknown')
  })
})
