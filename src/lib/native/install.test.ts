/**
 * Tests for the native bootstrap module. The module self-installs on
 * first import via `void installNativeIntegrations()`, so under jsdom
 * (where `isNative()` is false) the only thing that runs is
 * `initAppLifecycle()`. We verify:
 *
 *   1. Calling `installNativeIntegrations()` again is a no-op (does
 *      not throw, resolves successfully) — covers the `installed`
 *      guard.
 *   2. `initAppLifecycle` was actually invoked: registering a resume
 *      listener and dispatching `visibilitychange` fires it (the
 *      visibilitychange listener is only attached by
 *      `initAppLifecycle`).
 *   3. The `installNativeIntegrations` symbol is also re-exported
 *      from the barrel `./index.ts`.
 */

import { describe, it, expect } from 'vitest'

describe('native/install (web bootstrap)', () => {
  it('installNativeIntegrations resolves and is idempotent on web', async () => {
    const mod = await import('./install')
    await expect(mod.installNativeIntegrations()).resolves.toBeUndefined()
    // Second call must take the early-return branch and not throw.
    await expect(mod.installNativeIntegrations()).resolves.toBeUndefined()
  })

  it('also wires up app-lifecycle (visibilitychange fires resume listeners)', async () => {
    await import('./install')
    const { onAppResume } = await import('./app-lifecycle')

    let fired = 0
    const off = onAppResume(() => {
      fired++
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((r) => setTimeout(r, 0))
    expect(fired).toBeGreaterThanOrEqual(1)
    off()
  })

  it('barrel re-exports installNativeIntegrations as the same function', async () => {
    const direct = await import('./install')
    const barrel = await import('./index')
    expect(barrel.installNativeIntegrations).toBe(direct.installNativeIntegrations)
  })
})
