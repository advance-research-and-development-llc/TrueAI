/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Tests for the binary filesystem helpers added in PR 5 — web path.
 * Mocks the global `caches` Cache Storage API since jsdom does not
 * provide one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./platform', () => ({
  isNative: () => false,
  isAndroid: () => false,
  isIOS: () => false,
  getPlatform: () => 'web',
  isPluginAvailable: () => false,
}))

// Stub Capacitor Filesystem so the import resolves; web path doesn't call it.
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
    copy: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
  },
  Directory: { Documents: 'DOCUMENTS', Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
}))

// Minimal in-memory CacheStorage stub.
class MemCache {
  private store = new Map<string, Response>()
  async put(req: string, res: Response): Promise<void> {
    // Clone to consume the body once.
    const buf = await res.arrayBuffer()
    this.store.set(req, new Response(buf))
  }
  async match(req: string): Promise<Response | undefined> {
    const r = this.store.get(req)
    if (!r) return undefined
    return r.clone()
  }
  async delete(req: string): Promise<boolean> {
    return this.store.delete(req)
  }
}

class MemCacheStorage {
  private caches = new Map<string, MemCache>()
  async open(name: string): Promise<MemCache> {
    let c = this.caches.get(name)
    if (!c) {
      c = new MemCache()
      this.caches.set(name, c)
    }
    return c
  }
}

beforeEach(() => {
  vi.resetModules()
  ;(globalThis as unknown as { caches: MemCacheStorage }).caches = new MemCacheStorage()
})

describe('native/filesystem binary helpers (web path)', () => {
  it('getModelStoragePath returns "models"', async () => {
    const { getModelStoragePath } = await import('./filesystem')
    expect(getModelStoragePath()).toBe('models')
  })

  it('copyImportedModel + readFileChunk round-trip via Cache Storage', async () => {
    const { copyImportedModel, readFileChunk } = await import('./filesystem')
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const blob = new Blob([payload])
    const result = await copyImportedModel('ignored', 'abc.gguf', { sourceBlob: blob })
    expect(result.uri).toBe('cache://models/abc.gguf')
    expect(result.bytes).toBe(10)
    const slice = await readFileChunk(result.uri, 2, 4)
    expect(Array.from(slice)).toEqual([3, 4, 5, 6])
  })

  it('readFileChunk returns empty Uint8Array when offset is past EOF', async () => {
    const { copyImportedModel, readFileChunk } = await import('./filesystem')
    await copyImportedModel('x', 'small.gguf', { sourceBlob: new Blob([new Uint8Array([1, 2])]) })
    const out = await readFileChunk('cache://models/small.gguf', 100, 10)
    expect(out.length).toBe(0)
  })

  it('readFileChunk rejects negative offset / length', async () => {
    const { readFileChunk } = await import('./filesystem')
    await expect(readFileChunk('cache://x', -1, 4)).rejects.toThrow(/negative/)
    await expect(readFileChunk('cache://x', 0, -2)).rejects.toThrow(/negative/)
  })

  it('readFileChunk returns 0-length buffer when length is 0 (no I/O)', async () => {
    const { readFileChunk } = await import('./filesystem')
    const out = await readFileChunk('cache://does-not-exist', 0, 0)
    expect(out.length).toBe(0)
  })

  it('readFileChunk throws when cache entry is missing', async () => {
    const { readFileChunk } = await import('./filesystem')
    await expect(readFileChunk('cache://models/missing.gguf', 0, 4)).rejects.toThrow(
      /No cached model entry/,
    )
  })

  it('deleteModelFile removes a previously-written cache entry (idempotent)', async () => {
    const { copyImportedModel, deleteModelFile, readFileChunk } = await import('./filesystem')
    await copyImportedModel('x', 'rm.gguf', { sourceBlob: new Blob([new Uint8Array([42])]) })
    await deleteModelFile('cache://models/rm.gguf')
    await expect(readFileChunk('cache://models/rm.gguf', 0, 1)).rejects.toThrow()
    // Second delete is a no-op.
    await expect(deleteModelFile('cache://models/rm.gguf')).resolves.toBeUndefined()
  })

  it('copyImportedModel rejects path-traversal in targetFilename', async () => {
    const { copyImportedModel } = await import('./filesystem')
    await expect(
      copyImportedModel('x', '../../etc/passwd', { sourceBlob: new Blob([new Uint8Array([1])]) }),
    ).rejects.toThrow(/Invalid targetFilename/)
    await expect(
      copyImportedModel('x', 'a/b.gguf', { sourceBlob: new Blob([new Uint8Array([1])]) }),
    ).rejects.toThrow(/Invalid targetFilename/)
  })

  it('copyImportedModel requires sourceBlob on web', async () => {
    const { copyImportedModel } = await import('./filesystem')
    await expect(copyImportedModel('x', 'a.gguf')).rejects.toThrow(/sourceBlob/)
  })

  it('getFreeSpaceBytes returns bytes free when navigator.storage.estimate is available', async () => {
    const original = (globalThis as { navigator?: Navigator }).navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          estimate: async () => ({ quota: 1000, usage: 200 }),
        },
      },
      configurable: true,
    })
    try {
      const { getFreeSpaceBytes } = await import('./filesystem')
      await expect(getFreeSpaceBytes()).resolves.toBe(800)
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true })
    }
  })

  it('getFreeSpaceBytes returns null when estimate is unsupported', async () => {
    const original = (globalThis as { navigator?: Navigator }).navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: { storage: undefined },
      configurable: true,
    })
    try {
      const { getFreeSpaceBytes } = await import('./filesystem')
      await expect(getFreeSpaceBytes()).resolves.toBeNull()
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true })
    }
  })
})

describe('native/filesystem internal helpers', () => {
  it('base64 ↔ bytes round-trip', async () => {
    const { __test } = await import('./filesystem')
    const bytes = new Uint8Array([0, 1, 2, 100, 200, 255])
    const b64 = __test.bytesToBase64(bytes)
    const back = __test.base64ToBytes(b64)
    expect(Array.from(back)).toEqual(Array.from(bytes))
  })

  it('splitNativePath strips file:// scheme', async () => {
    const { __test } = await import('./filesystem')
    const split = __test.splitNativePath('file:///data/user/0/com.app/files/models/x.gguf')
    expect(split.path).toBe('file:///data/user/0/com.app/files/models/x.gguf')
    expect(split.directory).toBeUndefined()
  })

  it('splitNativePath treats a relative path as Directory.Data', async () => {
    const { __test } = await import('./filesystem')
    const split = __test.splitNativePath('models/x.gguf')
    expect(split.path).toBe('models/x.gguf')
    expect(split.directory).toBe('DATA')
  })
})
