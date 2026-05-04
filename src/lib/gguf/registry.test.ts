/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Tests for the GGUF registry. Mocks the filesystem + picker layers so
 * we exercise the registry's orchestration logic (parse → hash →
 * free-space guard → copy → KV write) deterministically.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/native/file-picker', () => ({
  isNativePickerAvailable: vi.fn(() => false),
  getFreeSpaceBytes: vi.fn(async () => null),
  deleteStagedFile: vi.fn(async () => undefined),
}))

const copyImportedModelMock = vi.fn()
const deleteModelFileMock = vi.fn()
const readFileChunkMock = vi.fn()
const getFreeSpaceMock = vi.fn(async () => null as number | null)

vi.mock('@/lib/native/filesystem', () => ({
  copyImportedModel: (...a: unknown[]) => copyImportedModelMock(...a),
  deleteModelFile: (...a: unknown[]) => deleteModelFileMock(...a),
  readFileChunk: (...a: unknown[]) => readFileChunkMock(...a),
  getFreeSpaceBytes: () => getFreeSpaceMock(),
}))

const updateLLMRuntimeConfigMock = vi.fn(async () => ({}))

vi.mock('@/lib/llm-runtime/config', () => ({
  updateLLMRuntimeConfig: (...a: unknown[]) => updateLLMRuntimeConfigMock(...a),
}))

// Use a real in-memory KV stub so list/persist round-trip behaves.
const kvBacking = new Map<string, unknown>()
const kvSubs = new Set<() => void>()

vi.mock('@/lib/llm-runtime/kv-store', () => ({
  kvStore: {
    async get<T>(key: string): Promise<T | undefined> {
      return kvBacking.get(key) as T | undefined
    },
    async set(key: string, value: unknown): Promise<void> {
      kvBacking.set(key, value)
      for (const cb of kvSubs) cb()
    },
    async setSecure(): Promise<void> {},
    async delete(key: string): Promise<void> {
      kvBacking.delete(key)
    },
    async keys(): Promise<string[]> {
      return Array.from(kvBacking.keys())
    },
    peek<T>(key: string): T | undefined {
      return kvBacking.get(key) as T | undefined
    },
    async getOrSet<T>(key: string, initial: T): Promise<T> {
      if (!kvBacking.has(key)) kvBacking.set(key, initial)
      return kvBacking.get(key) as T
    },
    subscribe(_key: string, listener: () => void): () => void {
      kvSubs.add(listener)
      return () => kvSubs.delete(listener)
    },
  },
}))

import {
  importFromPicked,
  removeById,
  markUsed,
  pickActiveModel,
  list,
  subscribe,
  __resetForTests,
  GGUF_MODELS_KV_KEY,
  LowDiskSpaceError,
  InvalidGGUFError,
} from './registry'
import { GGUFValueType, GGUF_MAGIC } from './parse'

// ---------------------------------------------------------------------------
// Tiny GGUF v3 writer (re-used from parse.test).

class W {
  private parts: Uint8Array[] = []
  private len = 0
  push(b: Uint8Array): void {
    this.parts.push(b)
    this.len += b.length
  }
  u32(v: number): void {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setUint32(0, v >>> 0, true)
    this.push(b)
  }
  u64(v: bigint): void {
    const b = new Uint8Array(8)
    new DataView(b.buffer).setBigUint64(0, v, true)
    this.push(b)
  }
  string(s: string): void {
    const enc = new TextEncoder().encode(s)
    this.u64(BigInt(enc.length))
    this.push(enc)
  }
  build(): Uint8Array {
    const out = new Uint8Array(this.len)
    let off = 0
    for (const p of this.parts) {
      out.set(p, off)
      off += p.length
    }
    return out
  }
}

function buildMiniGguf(arch = 'llama', name = 'Mini-Test'): Uint8Array {
  const w = new W()
  w.u32(GGUF_MAGIC)
  w.u32(3) // version
  w.u64(0n) // tensor_count
  w.u64(2n) // metadata_kv_count
  w.string('general.architecture')
  w.u32(GGUFValueType.STRING)
  w.string(arch)
  w.string('general.name')
  w.u32(GGUFValueType.STRING)
  w.string(name)
  return w.build()
}

beforeEach(() => {
  copyImportedModelMock.mockReset()
  deleteModelFileMock.mockReset()
  readFileChunkMock.mockReset()
  getFreeSpaceMock.mockReset().mockResolvedValue(null)
  updateLLMRuntimeConfigMock.mockReset().mockResolvedValue({})
  kvBacking.clear()
  kvSubs.clear()
  __resetForTests()
})

describe('gguf/registry — happy path', () => {
  it('imports a valid GGUF blob from a web File and writes a new record', async () => {
    const bytes = buildMiniGguf('llama', 'Test-Model')
    copyImportedModelMock.mockResolvedValue({
      uri: 'cache://models/<sha>.gguf',
      bytes: bytes.length,
    })

    const file = new File([bytes], 'test-model.gguf')
    const record = await importFromPicked({
      uri: '',
      displayName: 'test-model.gguf',
      size: bytes.length,
      cancelled: false,
      pickedFile: file,
    })

    expect(record.name).toBe('Test-Model')
    expect(record.id).toMatch(/^[0-9a-f]{64}$/)
    expect(record.filename).toBe(`${record.id}.gguf`)
    expect(record.path).toBe('cache://models/<sha>.gguf')
    expect(record.metadata.format).toBe('GGUF')
    expect(copyImportedModelMock).toHaveBeenCalledWith(
      '',
      `${record.id}.gguf`,
      expect.objectContaining({ sourceBlob: file }),
    )
    // KV array should now hold the record.
    const stored = kvBacking.get(GGUF_MODELS_KV_KEY) as unknown[]
    expect(stored).toHaveLength(1)
  })

  it('falls back to the picker filename when general.name is missing', async () => {
    const w = new W()
    w.u32(GGUF_MAGIC)
    w.u32(3)
    w.u64(0n)
    w.u64(0n)
    const bytes = w.build()
    copyImportedModelMock.mockResolvedValue({ uri: 'cache://x', bytes: bytes.length })
    const record = await importFromPicked({
      uri: '',
      displayName: 'my-cool-model.gguf',
      size: bytes.length,
      cancelled: false,
      pickedFile: new File([bytes], 'my-cool-model.gguf'),
    })
    expect(record.name).toBe('my-cool-model')
  })
})

describe('gguf/registry — idempotency', () => {
  it('re-importing the same SHA returns the existing record without copying twice', async () => {
    const bytes = buildMiniGguf()
    copyImportedModelMock.mockResolvedValueOnce({ uri: 'cache://1', bytes: bytes.length })

    const first = await importFromPicked({
      uri: '',
      displayName: 'a.gguf',
      size: bytes.length,
      cancelled: false,
      pickedFile: new File([bytes], 'a.gguf'),
    })
    expect(copyImportedModelMock).toHaveBeenCalledTimes(1)

    // Second import with identical bytes → must return the cached record.
    const second = await importFromPicked({
      uri: '',
      displayName: 'b.gguf',
      size: bytes.length,
      cancelled: false,
      pickedFile: new File([bytes], 'b.gguf'),
    })
    expect(second.id).toBe(first.id)
    expect(second.path).toBe(first.path)
    expect(copyImportedModelMock).toHaveBeenCalledTimes(1)
  })
})

describe('gguf/registry — failure paths', () => {
  it('rejects a non-GGUF file as InvalidGGUFError and skips the copy', async () => {
    const bogus = new Uint8Array([0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8])
    await expect(
      importFromPicked({
        uri: '',
        displayName: 'bogus.gguf',
        size: bogus.length,
        cancelled: false,
        pickedFile: new File([bogus], 'bogus.gguf'),
      }),
    ).rejects.toBeInstanceOf(InvalidGGUFError)
    expect(copyImportedModelMock).not.toHaveBeenCalled()
    // KV must remain empty.
    expect(kvBacking.get(GGUF_MODELS_KV_KEY)).toBeUndefined()
  })

  it('rejects with LowDiskSpaceError when free < size × 1.10', async () => {
    const bytes = buildMiniGguf()
    getFreeSpaceMock.mockResolvedValue(10) // 10 bytes free, file is much bigger
    await expect(
      importFromPicked({
        uri: '',
        displayName: 'a.gguf',
        size: bytes.length,
        cancelled: false,
        pickedFile: new File([bytes], 'a.gguf'),
      }),
    ).rejects.toBeInstanceOf(LowDiskSpaceError)
    expect(copyImportedModelMock).not.toHaveBeenCalled()
  })

  it('proceeds when free-space probe returns null (unknown)', async () => {
    const bytes = buildMiniGguf()
    getFreeSpaceMock.mockResolvedValue(null)
    copyImportedModelMock.mockResolvedValue({ uri: 'cache://x', bytes: bytes.length })
    await expect(
      importFromPicked({
        uri: '',
        displayName: 'a.gguf',
        size: bytes.length,
        cancelled: false,
        pickedFile: new File([bytes], 'a.gguf'),
      }),
    ).resolves.toMatchObject({ name: 'Mini-Test' })
  })

  it('rejects an already-cancelled picked input', async () => {
    await expect(
      importFromPicked({ uri: '', displayName: '', size: 0, cancelled: true }),
    ).rejects.toThrow(/cancelled/i)
  })

  it('rejects when the picked source has no bytes / no file', async () => {
    await expect(
      importFromPicked({ uri: '', displayName: 'x', size: 0, cancelled: false }),
    ).rejects.toThrow()
  })
})

describe('gguf/registry — list / remove / markUsed', () => {
  it('list() drops legacy KV entries that are missing required fields', async () => {
    kvBacking.set(GGUF_MODELS_KV_KEY, [
      { id: 'incomplete' }, // bad
      {
        id: 'good',
        name: 'g',
        filename: 'g.gguf',
        path: 'cache://g',
        size: 1,
        quantization: 'Q4',
        downloadedAt: 1,
        metadata: { format: 'GGUF' },
      },
    ])
    const ms = await list()
    expect(ms).toHaveLength(1)
    expect(ms[0].id).toBe('good')
  })

  it('removeById deletes the file and prunes the KV row (idempotent)', async () => {
    const bytes = buildMiniGguf()
    copyImportedModelMock.mockResolvedValue({ uri: 'cache://x', bytes: bytes.length })
    const r = await importFromPicked({
      uri: '',
      displayName: 'a.gguf',
      size: bytes.length,
      cancelled: false,
      pickedFile: new File([bytes], 'a.gguf'),
    })
    await removeById(r.id)
    expect(deleteModelFileMock).toHaveBeenCalledWith('cache://x')
    expect(await list()).toHaveLength(0)
    // Second remove is a no-op.
    await expect(removeById(r.id)).resolves.toBeUndefined()
  })

  it('markUsed bumps lastUsed; missing id is a no-op', async () => {
    const bytes = buildMiniGguf()
    copyImportedModelMock.mockResolvedValue({ uri: 'cache://x', bytes: bytes.length })
    const r = await importFromPicked({
      uri: '',
      displayName: 'a.gguf',
      size: bytes.length,
      cancelled: false,
      pickedFile: new File([bytes], 'a.gguf'),
    })
    await markUsed(r.id)
    const after = (await list())[0]
    expect(typeof after.lastUsed).toBe('number')
    await expect(markUsed('not-a-real-id')).resolves.toBeUndefined()
  })

  it('subscribe fires after every persist and unsubscribes cleanly', async () => {
    const bytes = buildMiniGguf()
    copyImportedModelMock.mockResolvedValue({ uri: 'cache://x', bytes: bytes.length })
    const cb = vi.fn()
    const off = subscribe(cb)
    await importFromPicked({
      uri: '',
      displayName: 'a.gguf',
      size: bytes.length,
      cancelled: false,
      pickedFile: new File([bytes], 'a.gguf'),
    })
    expect(cb).toHaveBeenCalled()
    off()
    cb.mockClear()
    await importFromPicked({
      // identical bytes → idempotent path, no persist, no notify
      uri: '',
      displayName: 'a.gguf',
      size: bytes.length,
      cancelled: false,
      pickedFile: new File([bytes], 'a.gguf'),
    })
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('gguf/registry — pickActiveModel', () => {
  it('updates baseUrl + defaultModel and bumps lastUsed', async () => {
    const bytes = buildMiniGguf()
    copyImportedModelMock.mockResolvedValue({
      uri: 'file:///data/files/models/sha.gguf',
      bytes: bytes.length,
    })
    const r = await importFromPicked({
      uri: '',
      displayName: 'a.gguf',
      size: bytes.length,
      cancelled: false,
      pickedFile: new File([bytes], 'a.gguf'),
    })
    const result = await pickActiveModel(r.id)
    expect(updateLLMRuntimeConfigMock).toHaveBeenCalledWith({
      baseUrl: 'file:///data/files/models/sha.gguf',
      defaultModel: 'Mini-Test',
    })
    expect(result.id).toBe(r.id)
    expect(typeof result.lastUsed).toBe('number')
  })

  it('rejects when the model id is unknown', async () => {
    await expect(pickActiveModel('unknown-id')).rejects.toThrow(/No model/)
  })
})
