/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * SAF / web file picker for the in-app GGUF importer (PR 5).
 *
 * On Android the work is done by the in-tree Capacitor plugin
 * `android/capacitor-file-picker/` — the system file picker hands the
 * Java side a SAF `content://` URI, which it stages into
 * `getFilesDir()/models/import-staging/<uuid>.gguf` and returns to JS
 * as a stable `file://` URI together with the original display name
 * and byte count.
 *
 * On web (and on platforms where the plugin is unavailable) we fall
 * back to a transient hidden `<input type="file" accept=".gguf">`
 * element. The user-supplied `File` is exposed to the registry via
 * `pickedFile`; the registry then hands that File to
 * `copyImportedModel(... , { sourceBlob })` for Cache-Storage
 * persistence.
 *
 * Threat model: this module never reads file contents itself. On
 * native, the plugin enforces that {@code deleteStaged} only removes
 * files under the staging directory. On web, the picker only ever
 * surfaces files the user explicitly chose via the system dialog.
 */

import { registerPlugin } from '@capacitor/core'
import { isAndroid, isPluginAvailable } from './platform'

export interface PickedGguf {
  /**
   * Native: a stable `file://` URI under app-private storage.
   * Web: empty string — `pickedFile` carries the bytes instead.
   */
  uri: string
  /** Sanitised display name reported by the OS picker. */
  displayName: string
  /** Byte count actually read into the staging copy. */
  size: number
  /** True when the user dismissed the picker without picking. */
  cancelled: boolean
  /**
   * Web only: the picked `File` object the caller can hand to
   * `copyImportedModel(..., { sourceBlob: pickedFile })`. Always
   * absent on native.
   */
  pickedFile?: File
}

interface FilePickerPlugin {
  pickGgufFile(): Promise<{
    uri: string
    displayName: string
    size: number
    cancelled: boolean
    declaredSize?: number
  }>
  getFreeSpaceBytes(): Promise<{ bytes: number }>
  deleteStaged(opts: { uri: string }): Promise<{ deleted: boolean }>
}

const NativePicker = registerPlugin<FilePickerPlugin>('FilePicker')

/**
 * True only when the native FilePicker plugin is registered AND
 * callable. Falls back to the web `<input type=file>` flow otherwise.
 */
export function isNativePickerAvailable(): boolean {
  return isAndroid() && isPluginAvailable('FilePicker')
}

/**
 * Best-effort free-space probe. On native, defers to the picker
 * plugin (`StatFs.getAvailableBytes()` over `getFilesDir()`). On web
 * the caller should fall back to the `getFreeSpaceBytes()` helper in
 * `src/lib/native/filesystem.ts` (which uses `navigator.storage.estimate()`).
 *
 * Returns `null` when the platform refuses to answer.
 */
export async function getFreeSpaceBytes(): Promise<number | null> {
  if (!isNativePickerAvailable()) return null
  try {
    const { bytes } = await NativePicker.getFreeSpaceBytes()
    return typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : null
  } catch {
    return null
  }
}

/** Test seam: lets the web fallback be exercised under jsdom. */
let webPickImpl: (() => Promise<PickedGguf>) | null = null

/** @internal — reserved for unit tests. */
export function __setWebPickImplForTests(impl: typeof webPickImpl): void {
  webPickImpl = impl
}

async function pickViaWeb(): Promise<PickedGguf> {
  if (webPickImpl) return webPickImpl()
  if (typeof document === 'undefined') {
    throw new Error('File picker is not available in this environment')
  }
  return new Promise<PickedGguf>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.gguf,application/octet-stream'
    input.style.position = 'fixed'
    input.style.opacity = '0'
    input.style.pointerEvents = 'none'

    let settled = false
    const finish = (value: PickedGguf) => {
      if (settled) return
      settled = true
      try {
        document.body.removeChild(input)
      } catch {
        // already removed
      }
      resolve(value)
    }

    input.addEventListener('change', () => {
      const file = input.files && input.files[0]
      if (!file) {
        finish({ uri: '', displayName: '', size: 0, cancelled: true })
        return
      }
      finish({
        uri: '',
        displayName: file.name,
        size: file.size,
        cancelled: false,
        pickedFile: file,
      })
    })

    // The `cancel` event fires on modern browsers when the user
    // dismisses the dialog without picking. Older browsers leave the
    // element idle, so we also wire a window-level focus fallback.
    input.addEventListener('cancel', () => {
      finish({ uri: '', displayName: '', size: 0, cancelled: true })
    })

    document.body.appendChild(input)
    input.click()
  })
}

/**
 * Prompt the user to pick a `.gguf` file. Resolves with `cancelled:
 * true` when the user dismisses the dialog — callers should treat that
 * as a no-op (no toast, no error).
 */
export async function pickGgufFile(): Promise<PickedGguf> {
  if (isNativePickerAvailable()) {
    const result = await NativePicker.pickGgufFile()
    return {
      uri: result.uri,
      displayName: result.displayName,
      size: typeof result.size === 'number' ? result.size : 0,
      cancelled: !!result.cancelled,
    }
  }
  return pickViaWeb()
}

/**
 * Best-effort delete of a native staging file. No-op on web (the
 * `<input type=file>` flow never touches disk).
 */
export async function deleteStagedFile(uri: string): Promise<void> {
  if (!uri) return
  if (!isNativePickerAvailable()) return
  if (!uri.startsWith('file://')) return
  try {
    await NativePicker.deleteStaged({ uri })
  } catch {
    // Idempotent contract — swallow.
  }
}
