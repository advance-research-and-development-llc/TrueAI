/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Tests for the web (jsdom) path of `native/file-picker`. Mocks the
 * platform as web and exercises the `<input type=file>` fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./platform', () => ({
  isNative: () => false,
  isAndroid: () => false,
  isIOS: () => false,
  getPlatform: () => 'web',
  isPluginAvailable: () => false,
}))

// Stub @capacitor/core so the registerPlugin call still resolves.
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    pickGgufFile: vi.fn(),
    getFreeSpaceBytes: vi.fn(),
    deleteStaged: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.resetModules()
})

describe('native/file-picker (web fallback)', () => {
  it('isNativePickerAvailable returns false on web', async () => {
    const { isNativePickerAvailable } = await import('./file-picker')
    expect(isNativePickerAvailable()).toBe(false)
  })

  it('getFreeSpaceBytes returns null on web (registry overlays via filesystem)', async () => {
    const { getFreeSpaceBytes } = await import('./file-picker')
    await expect(getFreeSpaceBytes()).resolves.toBeNull()
  })

  it('deleteStagedFile is a no-op on web (does not throw)', async () => {
    const { deleteStagedFile } = await import('./file-picker')
    await expect(deleteStagedFile('file:///x')).resolves.toBeUndefined()
    await expect(deleteStagedFile('')).resolves.toBeUndefined()
  })

  it('pickGgufFile returns the picked File when web fallback resolves with one', async () => {
    const { pickGgufFile, __setWebPickImplForTests } = await import('./file-picker')
    const file = new File([new Uint8Array([1, 2, 3])], 'm.gguf')
    __setWebPickImplForTests(async () => ({
      uri: '',
      displayName: 'm.gguf',
      size: 3,
      cancelled: false,
      pickedFile: file,
    }))
    const result = await pickGgufFile()
    expect(result.cancelled).toBe(false)
    expect(result.displayName).toBe('m.gguf')
    expect(result.size).toBe(3)
    expect(result.pickedFile).toBe(file)
  })

  it('pickGgufFile returns cancelled:true when user dismisses the dialog', async () => {
    const { pickGgufFile, __setWebPickImplForTests } = await import('./file-picker')
    __setWebPickImplForTests(async () => ({
      uri: '',
      displayName: '',
      size: 0,
      cancelled: true,
    }))
    const result = await pickGgufFile()
    expect(result.cancelled).toBe(true)
    expect(result.pickedFile).toBeUndefined()
  })

  it('default web fallback creates a hidden <input type=file> when invoked in jsdom', async () => {
    const mod = await import('./file-picker')
    // Don't await pickGgufFile — it will hang waiting for the user.
    // Instead, kick it off and inspect the DOM, then synthesise a
    // cancel event so the promise settles cleanly.
    const promise = mod.pickGgufFile()
    // `<input>` should have been appended to the document body.
    const input = document.querySelector('input[type=file]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    expect(input?.accept).toBe('.gguf,application/octet-stream')
    input?.dispatchEvent(new Event('cancel'))
    const result = await promise
    expect(result.cancelled).toBe(true)
  })
})
