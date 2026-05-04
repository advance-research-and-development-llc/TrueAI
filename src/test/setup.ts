import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// ---------------------------------------------------------------------------
// localStorage polyfill (Node 25 + jsdom interaction)
//
// Node 25 ships a native `globalThis.localStorage` that requires the
// `--localstorage-file=...` CLI flag to be a real Storage; without that
// flag it's a stub object with no methods. Because `window === globalThis`
// in vitest's jsdom environment, that broken native global shadows
// jsdom's own `window.localStorage`, breaking every test that uses
// bare `localStorage` (e.g. diagnostics, mobile-debug-logger, kv-store
// fallback, apkUpdateCheck cache, AdvancedSettings clear-cache button).
//
// We install a minimal Storage-shaped polyfill on both `globalThis` and
// `window` before any test code runs. Methods live on the prototype
// (not as own properties) so that production-style spies such as
// `vi.spyOn(Storage.prototype, 'clear')` reach the polyfill instances.
// ---------------------------------------------------------------------------
class MemoryStorage {
  private store = new Map<string, string>()
  get length(): number {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value))
  }
}

// Re-point the global `Storage` constructor at our polyfill so that
// `vi.spyOn(Storage.prototype, '<method>')` patches the same prototype
// our instances actually use. jsdom's own Storage class is unreachable
// because the native `localStorage` global already shadowed it.
;(globalThis as unknown as { Storage: typeof MemoryStorage }).Storage = MemoryStorage
if (typeof window !== 'undefined') {
  ;(window as unknown as { Storage: typeof MemoryStorage }).Storage = MemoryStorage
}

const memLocal = new MemoryStorage()
const memSession = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: memLocal,
})
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  writable: true,
  value: memSession,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: memLocal,
  })
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    writable: true,
    value: memSession,
  })
}

// Cleanup after each test
afterEach(() => {
  cleanup()
  // Wipe between tests so persistence-style tests don't bleed into each
  // other. Tests that need a specific seed should populate it in their
  // own beforeEach.
  try { localStorage.clear() } catch { /* fine */ }
  try { sessionStorage.clear() } catch { /* fine */ }
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
globalThis.IntersectionObserver = class IntersectionObserver {
  root = null
  rootMargin = ''
  thresholds = []

  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// IndexedDB is intentionally NOT mocked. jsdom doesn't ship a working
// implementation, and a partial stub (e.g. `{ open: vi.fn() }` returning
// `undefined`) caused every kv-store-touching test to log a noisy
// `[kv-store] IndexedDB unavailable, falling back to localStorage` stack
// trace as the kv-store tried to attach `onupgradeneeded` to an undefined
// request. By leaving `globalThis.indexedDB` unset, the kv-store's
// `hasIndexedDB()` check correctly returns false in tests and the
// localStorage fallback is taken silently.
//
// Tests that need a working (or deliberately failing) IDB — e.g.
// kv-store.test.ts's setSecure regression test — install their own
// `window.indexedDB` via `Object.defineProperty` and restore it in
// `finally`.

// Mock spark global
declare global {
  // @ts-expect-error - spark is a test mock
  var spark: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

// @ts-expect-error - spark is a test mock
globalThis.spark = {
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  user: vi.fn(),
}
