/**
 * Tests for `src/lib/native/install.ts`.
 *
 * `install.ts` has two awkward characteristics that shape this test file:
 *   1. It uses top-level `await import('@capacitor/...')` to lazy-load
 *      Capacitor plugins.
 *   2. It self-installs via `void installNativeIntegrations()` at the
 *      bottom of the module — meaning `initAppLifecycle` runs as a side
 *      effect of merely importing the module.
 *
 * We use top-level `vi.mock` so the hoisted mocks are in place before any
 * dynamic import (this is the same pattern that PR #59 established for
 * `preMountErrorCapture`'s renderFallback test). Per-test `vi.resetModules()`
 * + a fresh dynamic `import()` give each test a clean `installed` flag.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mocks } = vi.hoisted(() => {
  return {
    mocks: {
      isNative: vi.fn(() => false),
      initAppLifecycle: vi.fn(async () => {}),
      setStyle: vi.fn(async () => {}),
      setBackgroundColor: vi.fn(async () => {}),
      setOverlaysWebView: vi.fn(async () => {}),
      setResizeMode: vi.fn(async () => {}),
      setScroll: vi.fn(async () => {}),
      hideSplash: vi.fn(async () => {}),
    },
  }
})

vi.mock('./platform', () => ({
  isNative: mocks.isNative,
}))

vi.mock('./app-lifecycle', () => ({
  initAppLifecycle: mocks.initAppLifecycle,
}))

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: mocks.setStyle,
    setBackgroundColor: mocks.setBackgroundColor,
    setOverlaysWebView: mocks.setOverlaysWebView,
  },
  Style: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' },
}))

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    hide: mocks.hideSplash,
  },
}))

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    setResizeMode: mocks.setResizeMode,
    setScroll: mocks.setScroll,
  },
  KeyboardResize: { Body: 'body', Ionic: 'ionic', Native: 'native', None: 'none' },
}))

async function importInstall() {
  // Reset module-level state (`installed` flag, lazy-loaded plugin holders)
  // so each test imports a fresh copy that re-runs the self-install.
  vi.resetModules()
  return await import('./install')
}

describe('native/install', () => {
  beforeEach(() => {
    mocks.isNative.mockReset().mockReturnValue(false)
    mocks.initAppLifecycle.mockReset().mockResolvedValue(undefined)
    mocks.setStyle.mockReset().mockResolvedValue(undefined)
    mocks.setBackgroundColor.mockReset().mockResolvedValue(undefined)
    mocks.setOverlaysWebView.mockReset().mockResolvedValue(undefined)
    mocks.setResizeMode.mockReset().mockResolvedValue(undefined)
    mocks.setScroll.mockReset().mockResolvedValue(undefined)
    mocks.hideSplash.mockReset().mockResolvedValue(undefined)
  })

  it('exports installNativeIntegrations as an async function', async () => {
    const mod = await importInstall()
    expect(typeof mod.installNativeIntegrations).toBe('function')
    // Wait for the self-install promise chain to settle.
    await mod.installNativeIntegrations()
    expect(mocks.initAppLifecycle).toHaveBeenCalled()
  })

  it('runs initAppLifecycle on web and skips Capacitor plugin setup', async () => {
    mocks.isNative.mockReturnValue(false)
    const mod = await importInstall()
    await mod.installNativeIntegrations()

    expect(mocks.initAppLifecycle).toHaveBeenCalledTimes(1)
    expect(mocks.setStyle).not.toHaveBeenCalled()
    expect(mocks.setBackgroundColor).not.toHaveBeenCalled()
    expect(mocks.setOverlaysWebView).not.toHaveBeenCalled()
    expect(mocks.setResizeMode).not.toHaveBeenCalled()
    expect(mocks.setScroll).not.toHaveBeenCalled()
    expect(mocks.hideSplash).not.toHaveBeenCalled()
  })

  it('configures status bar, keyboard, and hides splash on native', async () => {
    mocks.isNative.mockReturnValue(true)
    const mod = await importInstall()
    await mod.installNativeIntegrations()

    // The in-flight self-install (`void installNativeIntegrations()`) is the
    // one actually performing the native setup; the explicit call above
    // returns immediately because the `installed` guard is already true.
    // `hideSplash` waits 50ms before calling SplashScreen.hide, so poll until
    // the self-install settles.
    await vi.waitFor(() => {
      expect(mocks.hideSplash).toHaveBeenCalled()
    })

    expect(mocks.initAppLifecycle).toHaveBeenCalledTimes(1)

    // Status bar configured to dark theme matching capacitor.config.ts.
    expect(mocks.setStyle).toHaveBeenCalledWith({ style: 'DARK' })
    expect(mocks.setBackgroundColor).toHaveBeenCalledWith({ color: '#1a1d24' })
    expect(mocks.setOverlaysWebView).toHaveBeenCalledWith({ overlay: false })

    // Keyboard configured to resize WebView body so chat inputs remain visible.
    expect(mocks.setResizeMode).toHaveBeenCalledWith({ mode: 'body' })
    expect(mocks.setScroll).toHaveBeenCalledWith({ isDisabled: false })

    // Splash screen hidden with the documented fade duration.
    expect(mocks.hideSplash).toHaveBeenCalledWith({ fadeOutDuration: 250 })
  })

  it('is idempotent — repeat calls do not re-run lifecycle init', async () => {
    mocks.isNative.mockReturnValue(false)
    const mod = await importInstall()

    // Wait for the self-install side effect to finish.
    await mod.installNativeIntegrations()
    const callsAfterSelfInstall = mocks.initAppLifecycle.mock.calls.length
    expect(callsAfterSelfInstall).toBe(1)

    // Subsequent explicit calls are no-ops.
    await mod.installNativeIntegrations()
    await mod.installNativeIntegrations()
    expect(mocks.initAppLifecycle).toHaveBeenCalledTimes(callsAfterSelfInstall)
  })

  it('survives initAppLifecycle throwing without rejecting installNativeIntegrations', async () => {
    mocks.initAppLifecycle.mockRejectedValueOnce(new Error('boom'))
    mocks.isNative.mockReturnValue(false)

    const mod = await importInstall()

    // The self-install must not produce an unhandled rejection. Calling
    // installNativeIntegrations again returns immediately because the
    // first invocation already flipped the `installed` guard.
    await expect(mod.installNativeIntegrations()).resolves.toBeUndefined()
  })

  it('survives a Capacitor plugin call rejecting on native', async () => {
    mocks.isNative.mockReturnValue(true)
    mocks.setStyle.mockRejectedValueOnce(new Error('status bar unavailable'))
    mocks.setResizeMode.mockRejectedValueOnce(new Error('keyboard unavailable'))
    mocks.hideSplash.mockRejectedValueOnce(new Error('splash unavailable'))

    const mod = await importInstall()
    // Even though every native step fails, install resolves cleanly.
    await expect(mod.installNativeIntegrations()).resolves.toBeUndefined()
    expect(mocks.initAppLifecycle).toHaveBeenCalledTimes(1)
  })

  it('barrel re-exports installNativeIntegrations as the same function', async () => {
    const direct = await importInstall()
    const barrel = await import('./index')
    expect(barrel.installNativeIntegrations).toBe(direct.installNativeIntegrations)
  })
})
