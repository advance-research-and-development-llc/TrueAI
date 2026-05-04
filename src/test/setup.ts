import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom 26+ no longer ships a working `Storage` implementation by default
// (the `--localstorage-file` warning seen in CI is the symptom). Provide a
// minimal in-memory polyfill so anything reading/writing localStorage or
// sessionStorage during tests behaves like a real browser. Each test gets a
// fresh store via the afterEach below.
function createMemoryStorage(): { Cls: new () => Storage; instance: Storage } {
  class MemoryStorage implements Storage {
    private data = new Map<string, string>()
    get length(): number {
      return this.data.size
    }
    clear(): void {
      this.data = new Map()
    }
    getItem(key: string): string | null {
      return this.data.has(key) ? (this.data.get(key) as string) : null
    }
    key(index: number): string | null {
      return Array.from(this.data.keys())[index] ?? null
    }
    removeItem(key: string): void {
      this.data.delete(key)
    }
    setItem(key: string, value: string): void {
      this.data.set(String(key), String(value))
    }
  }
  return { Cls: MemoryStorage, instance: new MemoryStorage() }
}

if (typeof window !== 'undefined') {
  const { Cls, instance: ls } = createMemoryStorage()
  const { instance: ss } = createMemoryStorage()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: ls })
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: ss })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: ls })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: ss })
  // Expose `Storage` so tests using `Storage.prototype` to spy on methods work.
  Object.defineProperty(window, 'Storage', { configurable: true, value: Cls })
  Object.defineProperty(globalThis, 'Storage', { configurable: true, value: Cls })
}

// Cleanup after each test
afterEach(() => {
  cleanup()
  try {
    window.localStorage?.clear()
    window.sessionStorage?.clear()
  } catch {
    // ignore - some tests stub these
  }
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
