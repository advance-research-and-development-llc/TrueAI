/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Tests for the Android path of `native/file-picker`. Mirrors the
 * mock-and-reimport pattern used by `secure-storage.android.test.ts`:
 * mock `./platform` as native + the `FilePicker` plugin available,
 * mock `@capacitor/core`'s `registerPlugin` so we can drive the
 * plugin proxy from the test, then `vi.resetModules()` so the SUT
 * binds to the mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./platform', () => ({
  isNative: () => true,
  isAndroid: () => true,
  isIOS: () => false,
  getPlatform: () => 'android',
  isPluginAvailable: () => true,
}))

const pickMock = vi.fn()
const freeMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    pickGgufFile: (...a: unknown[]) => pickMock(...a),
    getFreeSpaceBytes: (...a: unknown[]) => freeMock(...a),
    deleteStaged: (...a: unknown[]) => deleteMock(...a),
  }),
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    isPluginAvailable: () => true,
  },
}))

beforeEach(() => {
  pickMock.mockReset()
  freeMock.mockReset()
  deleteMock.mockReset()
  vi.resetModules()
})

describe('native/file-picker (Android paths)', () => {
  it('isNativePickerAvailable is true when the plugin is registered', async () => {
    const { isNativePickerAvailable } = await import('./file-picker')
    expect(isNativePickerAvailable()).toBe(true)
  })

  it('pickGgufFile returns the staged URI from the plugin', async () => {
    pickMock.mockResolvedValue({
      uri: 'file:///data/files/models/import-staging/uuid-m.gguf',
      displayName: 'm.gguf',
      size: 1234,
      cancelled: false,
      declaredSize: 1234,
    })
    const { pickGgufFile } = await import('./file-picker')
    const result = await pickGgufFile()
    expect(pickMock).toHaveBeenCalled()
    expect(result).toEqual({
      uri: 'file:///data/files/models/import-staging/uuid-m.gguf',
      displayName: 'm.gguf',
      size: 1234,
      cancelled: false,
    })
    expect(result.pickedFile).toBeUndefined()
  })

  it('pickGgufFile propagates cancelled:true from the plugin', async () => {
    pickMock.mockResolvedValue({
      uri: '',
      displayName: '',
      size: 0,
      cancelled: true,
    })
    const { pickGgufFile } = await import('./file-picker')
    await expect(pickGgufFile()).resolves.toMatchObject({ cancelled: true })
  })

  it('getFreeSpaceBytes returns the plugin-supplied number', async () => {
    freeMock.mockResolvedValue({ bytes: 12_345_678 })
    const { getFreeSpaceBytes } = await import('./file-picker')
    await expect(getFreeSpaceBytes()).resolves.toBe(12_345_678)
  })

  it('getFreeSpaceBytes returns null when the plugin throws', async () => {
    freeMock.mockRejectedValue(new Error('STATFS_FAILED'))
    const { getFreeSpaceBytes } = await import('./file-picker')
    await expect(getFreeSpaceBytes()).resolves.toBeNull()
  })

  it('getFreeSpaceBytes returns null when the plugin returns a non-finite value', async () => {
    freeMock.mockResolvedValue({ bytes: Number.POSITIVE_INFINITY })
    const { getFreeSpaceBytes } = await import('./file-picker')
    await expect(getFreeSpaceBytes()).resolves.toBeNull()
  })

  it('deleteStagedFile calls the plugin and is idempotent', async () => {
    deleteMock.mockResolvedValue({ deleted: true })
    const { deleteStagedFile } = await import('./file-picker')
    await deleteStagedFile('file:///data/files/models/import-staging/x.gguf')
    expect(deleteMock).toHaveBeenCalledWith({
      uri: 'file:///data/files/models/import-staging/x.gguf',
    })

    deleteMock.mockRejectedValue(new Error('ENOENT'))
    await expect(
      deleteStagedFile('file:///data/files/models/import-staging/x.gguf'),
    ).resolves.toBeUndefined()
  })

  it('deleteStagedFile is a no-op for non-file:// uris (defence in depth)', async () => {
    const { deleteStagedFile } = await import('./file-picker')
    await deleteStagedFile('cache://models/x.gguf')
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
