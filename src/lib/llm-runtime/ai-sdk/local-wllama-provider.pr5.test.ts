/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Tests for the new modelSource forms added in PR 5:
 *   - `cache://models/<sha>.gguf` — pulled from Cache Storage on web
 *   - `file://...`               — pulled via Capacitor.convertFileSrc
 *                                  on native, otherwise via
 *                                  `readFileChunk` + Blob fallback
 *
 * Lives in its own file so the provider's main test suite (and its
 * shared mock state) is left untouched.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadModelFromUrl = vi.fn(async () => {})
const loadModelFromHF = vi.fn(async () => {})
const loadModelFromBlob = vi.fn(async () => {})
const createChatCompletion = vi.fn(async () => 'ok')

class FakeWllama {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public assets: any) {}
  isModelLoaded() {
    return true
  }
  loadModelFromUrl = loadModelFromUrl
  loadModelFromHF = loadModelFromHF
  loadModelFromBlob = loadModelFromBlob
  createChatCompletion = createChatCompletion
}

vi.mock('@wllama/wllama', () => ({ Wllama: FakeWllama }))

const readFileChunkMock = vi.fn(async (_uri: string, _off: number, _len: number) => {
  return new Uint8Array([0x47, 0x47, 0x55, 0x46])
})

vi.mock('@/lib/native/filesystem', () => ({
  readFileChunk: (...a: unknown[]) =>
    readFileChunkMock(...(a as [string, number, number])),
}))

import {
  __resetLocalWllamaForTests,
  createLocalWllamaModel,
} from './local-wllama-provider'

describe('local-wllama-provider — PR 5 modelSource forms', () => {
  beforeEach(() => {
    __resetLocalWllamaForTests()
    loadModelFromUrl.mockClear()
    loadModelFromHF.mockClear()
    loadModelFromBlob.mockClear()
    createChatCompletion.mockClear()
    readFileChunkMock.mockClear()
    // Defaults: no Capacitor, in-memory Cache Storage stub.
    delete (globalThis as { Capacitor?: unknown }).Capacitor
    const cacheBacking = new Map<string, Response>()
    ;(globalThis as { caches: unknown }).caches = {
      async open() {
        return {
          async match(req: string): Promise<Response | undefined> {
            const r = cacheBacking.get(req)
            return r ? r.clone() : undefined
          },
          async put(req: string, res: Response): Promise<void> {
            const buf = await res.arrayBuffer()
            cacheBacking.set(req, new Response(buf))
          },
          async delete(req: string): Promise<boolean> {
            return cacheBacking.delete(req)
          },
        }
      },
    }
    // Pre-populate one cache entry for the cache:// test.
    void (globalThis as { caches: { open(name: string): Promise<{ put(r: string, res: Response): Promise<void> }> } })
      .caches.open('truai-models')
      .then((c) => c.put('models/abc.gguf', new Response(new Uint8Array([0x47, 0x47, 0x55, 0x46]).buffer)))
  })

  afterEach(() => {
    __resetLocalWllamaForTests()
  })

  it('cache:// source loads via loadModelFromBlob from Cache Storage', async () => {
    // Wait one microtask for the seed put() above to land.
    await Promise.resolve()
    await Promise.resolve()
    const model = createLocalWllamaModel({
      modelSource: 'cache://models/abc.gguf',
      modelId: 'imported',
    })
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    expect(loadModelFromBlob).toHaveBeenCalledTimes(1)
    expect(loadModelFromUrl).not.toHaveBeenCalled()
    expect(loadModelFromHF).not.toHaveBeenCalled()
    const blobArg = loadModelFromBlob.mock.calls[0][0]
    expect(blobArg).toBeInstanceOf(Blob)
  })

  it('cache:// source rejects when the cache entry is missing', async () => {
    const model = createLocalWllamaModel({
      modelSource: 'cache://models/missing.gguf',
      modelId: 'imported',
    })
    await expect(
      model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      }),
    ).rejects.toThrow(/No cached model entry/)
  })

  it('file:// source uses Capacitor.convertFileSrc when available', async () => {
    ;(globalThis as { Capacitor?: { convertFileSrc(uri: string): string } }).Capacitor = {
      convertFileSrc: (uri: string) => `https://localhost/_capacitor_file_/${uri.slice(7)}`,
    }
    const model = createLocalWllamaModel({
      modelSource: 'file:///data/files/models/x.gguf',
      modelId: 'imported',
    })
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    expect(loadModelFromUrl).toHaveBeenCalledTimes(1)
    expect(loadModelFromUrl.mock.calls[0][0]).toBe(
      'https://localhost/_capacitor_file_//data/files/models/x.gguf',
    )
    expect(loadModelFromBlob).not.toHaveBeenCalled()
  })

  it('file:// source falls back to readFileChunk + loadModelFromBlob when convertFileSrc is unavailable', async () => {
    const model = createLocalWllamaModel({
      modelSource: 'file:///data/files/models/y.gguf',
      modelId: 'imported',
    })
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    expect(readFileChunkMock).toHaveBeenCalled()
    expect(loadModelFromBlob).toHaveBeenCalledTimes(1)
    expect(loadModelFromUrl).not.toHaveBeenCalled()
  })
})
