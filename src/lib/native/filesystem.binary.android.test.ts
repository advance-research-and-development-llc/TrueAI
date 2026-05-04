/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Tests for the binary filesystem helpers — Android (Capacitor) path.
 * Mirrors the mock-and-reimport pattern used by
 * `secure-storage.android.test.ts`: mock `./platform` as native and
 * `@capacitor/filesystem` as a controllable in-memory backing store,
 * then `vi.resetModules()` so the SUT closure binds to the mocked
 * Filesystem singleton.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./platform', () => ({
  isNative: () => true,
  isAndroid: () => true,
  isIOS: () => false,
  getPlatform: () => 'android',
  isPluginAvailable: () => true,
}))

const writeFileMock = vi.fn()
const readFileMock = vi.fn()
const deleteFileMock = vi.fn()
const copyMock = vi.fn()
const statMock = vi.fn()
const mkdirMock = vi.fn()

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: (...a: unknown[]) => writeFileMock(...a),
    readFile: (...a: unknown[]) => readFileMock(...a),
    deleteFile: (...a: unknown[]) => deleteFileMock(...a),
    copy: (...a: unknown[]) => copyMock(...a),
    stat: (...a: unknown[]) => statMock(...a),
    mkdir: (...a: unknown[]) => mkdirMock(...a),
  },
  Directory: { Documents: 'DOCUMENTS', Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
}))

beforeEach(() => {
  writeFileMock.mockReset()
  readFileMock.mockReset()
  deleteFileMock.mockReset()
  copyMock.mockReset()
  statMock.mockReset()
  mkdirMock.mockReset()
  vi.resetModules()
})

describe('native/filesystem binary helpers (Android path)', () => {
  it('readFileChunk reads via Filesystem.readFile and slices the result', async () => {
    // Provide bytes [0..15] base64-encoded.
    const bytes = new Uint8Array(16)
    for (let i = 0; i < 16; i += 1) bytes[i] = i
    const b64 = Buffer.from(bytes).toString('base64')
    readFileMock.mockResolvedValue({ data: b64 })

    const { readFileChunk } = await import('./filesystem')
    const out = await readFileChunk('file:///data/files/models/x.gguf', 4, 6)
    expect(Array.from(out)).toEqual([4, 5, 6, 7, 8, 9])
    expect(readFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'file:///data/files/models/x.gguf' }),
    )
  })

  it('readFileChunk strips a relative path through Directory.Data', async () => {
    readFileMock.mockResolvedValue({ data: Buffer.from(new Uint8Array([99])).toString('base64') })
    const { readFileChunk } = await import('./filesystem')
    const out = await readFileChunk('models/x.gguf', 0, 1)
    expect(Array.from(out)).toEqual([99])
    expect(readFileMock).toHaveBeenCalledWith({ path: 'models/x.gguf', directory: 'DATA' })
  })

  it('copyImportedModel uses Filesystem.copy when available', async () => {
    copyMock.mockResolvedValue({ uri: 'file:///data/files/models/abc.gguf' })
    statMock.mockResolvedValue({ size: 4096, uri: 'file:///data/files/models/abc.gguf' })
    mkdirMock.mockResolvedValue(undefined)

    const { copyImportedModel } = await import('./filesystem')
    const result = await copyImportedModel(
      'file:///cache/staging/raw.gguf',
      'abc.gguf',
    )
    expect(mkdirMock).toHaveBeenCalledWith({
      path: 'models',
      directory: 'DATA',
      recursive: true,
    })
    expect(copyMock).toHaveBeenCalledWith({
      from: 'file:///cache/staging/raw.gguf',
      to: 'models/abc.gguf',
      toDirectory: 'DATA',
    })
    expect(result).toEqual({
      uri: 'file:///data/files/models/abc.gguf',
      bytes: 4096,
    })
  })

  it('copyImportedModel tolerates mkdir failure (dir already exists)', async () => {
    copyMock.mockResolvedValue({ uri: 'file:///data/files/models/x.gguf' })
    statMock.mockResolvedValue({ size: 1, uri: 'file:///data/files/models/x.gguf' })
    mkdirMock.mockRejectedValue(new Error('EEXIST'))

    const { copyImportedModel } = await import('./filesystem')
    await expect(
      copyImportedModel('file:///src', 'x.gguf'),
    ).resolves.toEqual({ uri: 'file:///data/files/models/x.gguf', bytes: 1 })
  })

  it('deleteModelFile calls Filesystem.deleteFile and is idempotent', async () => {
    deleteFileMock.mockResolvedValue(undefined)
    const { deleteModelFile } = await import('./filesystem')
    await deleteModelFile('file:///data/files/models/x.gguf')
    expect(deleteFileMock).toHaveBeenCalledWith({
      path: 'file:///data/files/models/x.gguf',
    })

    // Second call: simulate a "no such file" rejection — must not throw.
    deleteFileMock.mockRejectedValue(new Error('ENOENT'))
    await expect(
      deleteModelFile('file:///data/files/models/x.gguf'),
    ).resolves.toBeUndefined()
  })

  it('getFreeSpaceBytes returns null on native (delegated to picker plugin)', async () => {
    const { getFreeSpaceBytes } = await import('./filesystem')
    await expect(getFreeSpaceBytes()).resolves.toBeNull()
  })

  it('copyImportedModel rejects path traversal in targetFilename even on native', async () => {
    const { copyImportedModel } = await import('./filesystem')
    await expect(copyImportedModel('file:///s', '../etc/passwd')).rejects.toThrow(
      /Invalid targetFilename/,
    )
  })
})
