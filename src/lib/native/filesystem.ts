/**
 * File save / load helpers.
 *
 * Two distinct surfaces live in this module:
 *
 *   1. Text save (`saveTextFile`) — writes to the platform Documents
 *      directory on native (URI is shareable), or triggers an anchor
 *      download on web. Pre-existing API.
 *
 *   2. Binary model storage (`readFileChunk`, `copyImportedModel`,
 *      `deleteModelFile`, `getFreeSpaceBytes`) — added in PR 5 for the
 *      GGUF importer. Stores files **app-private** under
 *      `Filesystem.Directory.Data/models/` on native (≈
 *      `Context.getFilesDir()` — invisible to the user without ADB),
 *      and uses the Cache Storage API on web (NOT IndexedDB; we want
 *      multi-GB blobs to live outside the JS heap).
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { isNative } from './platform'

export interface SaveTextFileResult {
  /** Absolute path or object URL where the file lives. */
  uri: string
  /** Suggested filename used. */
  filename: string
}

function sanitiseFilename(name: string): string {
  // Replace any character outside the safe set with `_`, neutralise any
  // `..` parent-directory traversal sequences, strip leading dots/
  // underscores, and trim to a sane length. Falls back to a literal
  // `file` when the input has no alphanumeric content to anchor on.
  const cleaned = name
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^[._]+/, '')
    .replace(/_+/g, '_')
    .slice(0, 120)
  if (!/[A-Za-z0-9]/.test(cleaned)) return 'file'
  return cleaned
}

function pickMimeType(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.md')) return 'text/markdown'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.csv')) return 'text/csv'
  if (lower.endsWith('.html')) return 'text/html'
  return 'application/octet-stream'
}

/**
 * Persist text content to a user-accessible location and return a URI
 * suitable for `share()` (native) or download (web).
 */
export async function saveTextFile(
  filename: string,
  content: string,
): Promise<SaveTextFileResult> {
  const safeName = sanitiseFilename(filename)
  if (isNative()) {
    const result = await Filesystem.writeFile({
      path: safeName,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    return { uri: result.uri, filename: safeName }
  }

  // Web fallback: blob + anchor download.
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('saveTextFile is only available in browser environments')
  }
  const blob = new Blob([content], { type: pickMimeType(safeName) })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Revoke after a tick so the browser has time to start the download.
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }, 1000)
  return { uri: url, filename: safeName }
}

// ===========================================================================
// Binary model storage (PR 5 — GGUF importer)

/**
 * Subdirectory under `Filesystem.Directory.Data` (native) or under the
 * `truai-models` Cache Storage cache (web) where imported `.gguf`
 * files live. Public so callers can render `${getModelStoragePath()}/<sha>.gguf`
 * for display.
 */
export function getModelStoragePath(): string {
  return 'models'
}

const WEB_MODEL_CACHE = 'truai-models'

/**
 * Maximum chunk size for binary reads / writes on native. Capacitor
 * marshals the bytes through the JS bridge as base64; chunks above
 * a few MB risk OOM on low-end Android devices and stall the bridge
 * for noticeable time. 4 MiB is the empirical sweet spot used by the
 * Capacitor Filesystem docs themselves for "big file" recipes.
 */
export const NATIVE_BINARY_CHUNK_BYTES = 4 * 1024 * 1024

/**
 * Strip the leading `file://` scheme that Capacitor returns on Android
 * but `Filesystem.readFile` does NOT accept when paired with a
 * `directory:` argument. Used by the chunked reader so callers can pass
 * either a relative path under `Directory.Data` or an absolute
 * `file://...` URI returned by the SAF picker.
 */
function splitNativePath(uri: string): { path: string; directory?: Directory } {
  if (uri.startsWith('file://')) {
    return { path: uri }
  }
  // Treat as a path relative to Data (where copyImportedModel writes).
  return { path: uri, directory: Directory.Data }
}

/**
 * Decode a Capacitor base64 chunk to a `Uint8Array`. Uses Node `Buffer`
 * when available (faster on the JNI bridge thread) and falls back to
 * `atob` on web — matching the pattern Capacitor's own docs recommend.
 */
function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64')
    // Always copy: a `Buffer` is itself a Uint8Array view but its
    // backing ArrayBuffer is shared with other Buffers in pool — the
    // GGUF parser stores subarray slices long-term, so we need a
    // private buffer.
    return new Uint8Array(buf)
  }
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let s = ''
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

interface CacheLike {
  put(request: string, response: Response): Promise<void>
  match(request: string): Promise<Response | undefined>
  delete(request: string): Promise<boolean>
}

interface CacheStorageLike {
  open(name: string): Promise<CacheLike>
}

/** Resolve `caches` defensively — `CacheStorage` is unavailable in jsdom. */
function getCacheStorage(): CacheStorageLike | null {
  const c =
    typeof globalThis !== 'undefined'
      ? (globalThis as { caches?: CacheStorageLike }).caches
      : undefined
  return c ?? null
}

/**
 * Read a contiguous byte range from a file. Source-uri conventions:
 *
 *   - Native: an absolute `file://...` URI (e.g. from the SAF picker
 *     or returned from `copyImportedModel`), OR a path relative to
 *     `Directory.Data` (e.g. `models/<sha>.gguf`).
 *   - Web: `cache://<key>` where `<key>` is a path under the
 *     `truai-models` Cache (e.g. `cache://models/<sha>.gguf`).
 */
export async function readFileChunk(
  uri: string,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  if (length < 0) throw new Error(`readFileChunk: negative length ${length}`)
  if (offset < 0) throw new Error(`readFileChunk: negative offset ${offset}`)
  if (length === 0) return new Uint8Array(0)
  if (isNative()) {
    const { path, directory } = splitNativePath(uri)
    // Capacitor 8's Filesystem.readFile returns the entire file as
    // base64 (no first-class range-read API on Android). For GGUF
    // header parsing the parser asks for ≤2 MB total, and the picker
    // plugin (PR 5 phase 3) stages picked files into app-private
    // storage where the round-trip is cheap. For multi-GB hashing the
    // caller should prefer the picker plugin's hash output directly;
    // this single-shot read is the simple correct fallback.
    const res = await Filesystem.readFile({ path, directory })
    const data = (res as { data: string | Blob }).data
    const all =
      typeof data === 'string'
        ? base64ToBytes(data)
        : new Uint8Array(await (data as Blob).arrayBuffer())
    if (offset >= all.length) return new Uint8Array(0)
    return all.slice(offset, Math.min(all.length, offset + length))
  }
  // Web: pull from Cache Storage.
  if (uri.startsWith('cache://')) {
    const cs = getCacheStorage()
    if (!cs) throw new Error('Cache Storage is not available in this environment')
    const cache = await cs.open(WEB_MODEL_CACHE)
    const key = uri.slice('cache://'.length)
    const res = await cache.match(key)
    if (!res) throw new Error(`No cached model entry: ${uri}`)
    const buf = await res.arrayBuffer()
    const all = new Uint8Array(buf)
    if (offset >= all.length) return new Uint8Array(0)
    return all.slice(offset, Math.min(all.length, offset + length))
  }
  throw new Error(`Unsupported URI scheme for web readFileChunk: ${uri}`)
}

/**
 * Copy a picked / imported file into permanent app-private model
 * storage. Returns a URI suitable for `readFileChunk` and for the
 * `local-native` provider's `modelPath` (native) or for the
 * `local-wasm` provider's `modelSource` (web — `cache://...`).
 *
 *   - sourceUri: native = absolute `file://` URI returned by the SAF
 *     picker; web = a `Blob` (passed through the optional `sourceBlob`).
 *   - targetFilename: bare filename (no path separators) — typically
 *     `<sha256>.gguf`. The function rejects path traversal segments.
 */
export interface CopyImportedModelOptions {
  /** Web: the picked File / Blob to persist. Ignored on native. */
  sourceBlob?: Blob
}

export interface CopyImportedModelResult {
  /** URI suitable for `readFileChunk` and provider modelPath. */
  uri: string
  /** Total bytes written. */
  bytes: number
}

export async function copyImportedModel(
  sourceUri: string,
  targetFilename: string,
  options: CopyImportedModelOptions = {},
): Promise<CopyImportedModelResult> {
  if (
    !targetFilename ||
    targetFilename.includes('/') ||
    targetFilename.includes('\\') ||
    targetFilename.includes('..')
  ) {
    throw new Error(`Invalid targetFilename: ${targetFilename}`)
  }
  const relPath = `${getModelStoragePath()}/${targetFilename}`
  if (isNative()) {
    // On native we expect the picker plugin (PR 5 phase 3) to have
    // already staged the file under app-private storage and to hand us
    // an absolute `file://` URI. If the source already lives in our
    // models/ subdir, no-op; otherwise copy via Filesystem.copy.
    const { path: srcPath } = splitNativePath(sourceUri)
    // Use Filesystem.copy when supported — it streams server-side and
    // never marshals the bytes through the JS bridge.
    const fsAny = Filesystem as unknown as {
      copy?: (opts: { from: string; to: string; toDirectory?: Directory }) => Promise<{ uri: string }>
      stat: (opts: { path: string; directory?: Directory }) => Promise<{ size: number; uri: string }>
    }
    if (typeof fsAny.copy === 'function') {
      // Ensure the parent directory exists. Filesystem.mkdir is
      // idempotent when `recursive: true` AND the dir already exists
      // (Capacitor swallows the EEXIST internally).
      try {
        await Filesystem.mkdir({
          path: getModelStoragePath(),
          directory: Directory.Data,
          recursive: true,
        })
      } catch {
        // Directory may already exist on the second import — ignore.
      }
      const result = await fsAny.copy({
        from: srcPath,
        to: relPath,
        toDirectory: Directory.Data,
      })
      const stat = await fsAny.stat({ path: relPath, directory: Directory.Data })
      return { uri: result.uri ?? stat.uri, bytes: stat.size }
    }
    // Fallback: read the source file as a single base64 blob and
    // re-write it. Slower and bounded by available memory but works
    // with stripped Capacitor Filesystem builds.
    const read = await Filesystem.readFile({ path: srcPath })
    const data = (read as { data: string | Blob }).data
    if (typeof data !== 'string') {
      throw new Error('Filesystem.readFile returned a Blob on native — unsupported')
    }
    const written = await Filesystem.writeFile({
      path: relPath,
      data,
      directory: Directory.Data,
      recursive: true,
    })
    const bytes = base64ToBytes(data).length
    return { uri: written.uri, bytes }
  }
  // Web: persist the Blob in Cache Storage.
  const cs = getCacheStorage()
  if (!cs) {
    throw new Error('Cache Storage is not available — cannot persist imported model')
  }
  const blob = options.sourceBlob
  if (!blob) {
    throw new Error('copyImportedModel on web requires sourceBlob')
  }
  const cache = await cs.open(WEB_MODEL_CACHE)
  const key = relPath
  // Convert to ArrayBuffer first: jsdom (and some older Workers) don't
  // accept a `Blob` body in `new Response(...)` cleanly. Reading the
  // bytes upfront also lets us return the exact byte count.
  const buf = await blob.arrayBuffer()
  await cache.put(
    key,
    new Response(buf, { headers: { 'content-type': 'application/octet-stream' } }),
  )
  return { uri: `cache://${key}`, bytes: buf.byteLength }
}

/**
 * Idempotently delete a model file written by `copyImportedModel`.
 * Accepts the URI returned from that call.
 */
export async function deleteModelFile(uri: string): Promise<void> {
  if (isNative()) {
    const { path, directory } = splitNativePath(uri)
    try {
      await Filesystem.deleteFile({ path, directory })
    } catch {
      // File may already be gone (idempotent contract).
    }
    return
  }
  if (uri.startsWith('cache://')) {
    const cs = getCacheStorage()
    if (!cs) return
    const cache = await cs.open(WEB_MODEL_CACHE)
    await cache.delete(uri.slice('cache://'.length))
  }
}

/**
 * Best-effort free-space probe. Returns bytes available in the storage
 * area where imported models live, or `null` when the platform does
 * not expose that information.
 *
 *   - Native: provided by the in-tree file-picker plugin
 *     (`src/lib/native/file-picker.ts:getFreeSpaceBytes`). This module
 *     does not import that file — the registry composes the two — so
 *     this function returns `null` on native and lets the registry
 *     overlay the picker-plugin value.
 *   - Web: `(navigator.storage.estimate()).quota - usage` when
 *     supported.
 */
export async function getFreeSpaceBytes(): Promise<number | null> {
  if (isNative()) {
    // Native answer comes from the file-picker plugin; the registry
    // wires that in. Returning null here keeps this module dependency-free.
    return null
  }
  try {
    const nav =
      typeof navigator !== 'undefined'
        ? (navigator as { storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> } })
        : undefined
    const est = await nav?.storage?.estimate?.()
    if (!est || typeof est.quota !== 'number' || typeof est.usage !== 'number') {
      return null
    }
    return Math.max(0, est.quota - est.usage)
  } catch {
    return null
  }
}

// Internal helpers exported for unit tests only — NOT part of the
// public API. The test files import these via `import * as fs`.
export const __test = {
  base64ToBytes,
  bytesToBase64,
  splitNativePath,
  WEB_MODEL_CACHE,
}
