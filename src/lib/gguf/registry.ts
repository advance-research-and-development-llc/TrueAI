/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * On-disk GGUF model registry — the brain behind the in-app GGUF
 * importer (PR 5).
 *
 * Responsibilities:
 *   1. Take a picked file (native: a `file://` URI staged by the
 *      `FilePicker` plugin; web: a `File`/`Blob`).
 *   2. Validate it as real GGUF by parsing the header (Phase 1).
 *   3. Compute its SHA-256 (de-dupe key + canonical id).
 *   4. Refuse the import if free disk space is below `size * 1.10`
 *      (Phase 2 + Phase 3 free-space probes).
 *   5. Copy the bytes into permanent app-private storage at
 *      `models/<sha>.gguf` (Phase 2 `copyImportedModel`).
 *   6. Persist a typed `GGUFModel` record under the existing
 *      `gguf-models` KV key.
 *   7. Wire "set active" into `LLMRuntimeConfig` (`baseUrl` →
 *      file URI, `defaultModel` → friendly name) so both
 *      `local-native` and `local-wasm` providers light up
 *      automatically.
 *
 * Idempotent in two directions:
 *   - Re-importing a file with the same SHA returns the existing
 *     record (and unlinks the staging file). No duplicate row, no
 *     duplicate disk usage.
 *   - `removeById` is idempotent: a missing record / missing file
 *     resolves cleanly.
 *
 * The full file content is read once for hashing. On native this is
 * bounded by the device's RAM via Capacitor's base64 marshalling
 * limit; for multi-GB models a future PR can swap the JS-side hash
 * for a JNI `MessageDigest` accumulator inside the picker plugin.
 */

import { kvStore } from '@/lib/llm-runtime/kv-store'
import { updateLLMRuntimeConfig } from '@/lib/llm-runtime/config'
import type { GGUFModel, GGUFMetadata } from '@/lib/types'
import {
  parseGGUFHeader,
  type GGUFReader,
  type DerivedMetadata,
} from './parse'
import {
  copyImportedModel,
  deleteModelFile,
  readFileChunk,
  getFreeSpaceBytes as getStorageFreeSpaceBytes,
  type CopyImportedModelResult,
} from '@/lib/native/filesystem'
import {
  deleteStagedFile,
  isNativePickerAvailable,
  getFreeSpaceBytes as getPickerFreeSpaceBytes,
  type PickedGguf,
} from '@/lib/native/file-picker'

export const GGUF_MODELS_KV_KEY = 'gguf-models'

/** Free-space safety margin: refuse to import if free < size × this. */
const FREE_SPACE_MARGIN = 1.1

/** Cache for the registry's local view of the KV array. */
let cachedList: GGUFModel[] | null = null

/** Listeners notified after every successful mutation. */
const listeners = new Set<(models: GGUFModel[]) => void>()

function notify(models: GGUFModel[]): void {
  for (const cb of listeners) {
    try {
      cb(models)
    } catch {
      // Subscriber errors must not poison the registry.
    }
  }
}

/** Subscribe to the registry's mutations. Returns an unsubscribe. */
export function subscribe(cb: (models: GGUFModel[]) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/**
 * Sniff a stored entry to drop legacy rows that pre-date PR 5 and lack
 * the fields the registry needs. Avoids a hard schema migration.
 */
function isWellFormed(m: unknown): m is GGUFModel {
  if (!m || typeof m !== 'object') return false
  const r = m as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.filename === 'string' &&
    typeof r.path === 'string' &&
    typeof r.size === 'number' &&
    typeof r.quantization === 'string' &&
    typeof r.downloadedAt === 'number' &&
    !!r.metadata
  )
}

/**
 * Hydrate the registry's in-memory cache from the KV store. Drops
 * malformed entries silently. Cached after first call.
 */
export async function list(): Promise<GGUFModel[]> {
  if (cachedList) return cachedList
  const raw = await kvStore.get<unknown>(GGUF_MODELS_KV_KEY)
  if (Array.isArray(raw)) {
    cachedList = raw.filter(isWellFormed)
  } else {
    cachedList = []
  }
  return cachedList
}

async function persist(next: GGUFModel[]): Promise<void> {
  cachedList = next
  await kvStore.set(GGUF_MODELS_KV_KEY, next)
  notify(next)
}

/** Test-only: clear the in-memory cache and listener set. */
export function __resetForTests(): void {
  cachedList = null
  listeners.clear()
}

export class LowDiskSpaceError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(
      `Not enough free space to import this model: need at least ${formatBytes(required)} ` +
        `(file size + 10% safety margin), only ${formatBytes(available)} available.`,
    )
    this.name = 'LowDiskSpaceError'
  }
}

export class InvalidGGUFError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidGGUFError'
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

function bytesToHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 1) {
    s += bytes[i].toString(16).padStart(2, '0')
  }
  return s
}

/**
 * SHA-256 the supplied bytes via WebCrypto. We accept a `Uint8Array`
 * here rather than streaming chunks because GGUF files are typically
 * read end-to-end (parser already touched the head; the registry
 * needs the whole content to hash). Future PR can replace this with a
 * JNI `MessageDigest` accumulator if multi-GB support becomes a hard
 * requirement.
 */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined'
      ? globalThis.crypto.subtle
      : null
  if (!subtle) {
    throw new Error('SubtleCrypto.digest is not available in this environment')
  }
  // crypto.subtle.digest accepts ArrayBuffer or BufferSource. Pass the
  // backing buffer with explicit byteOffset/length to avoid copying.
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const digest = await subtle.digest('SHA-256', ab)
  return bytesToHex(new Uint8Array(digest))
}

/**
 * Read all bytes from the supplied source. On web we already have a
 * `Blob`; on native we read the file via `readFileChunk` (which on
 * Capacitor 8 is a single base64 round-trip).
 */
async function readAllBytes(picked: PickedGguf): Promise<Uint8Array> {
  if (picked.pickedFile) {
    return new Uint8Array(await picked.pickedFile.arrayBuffer())
  }
  if (!picked.uri) {
    throw new Error('readAllBytes: picked has neither uri nor pickedFile')
  }
  // Read up to (declared size + 1) so the helper returns the whole
  // file. `readFileChunk` truncates to the actual file length and is
  // safe to overshoot.
  const cap = picked.size > 0 ? picked.size : 1 << 30
  return readFileChunk(picked.uri, 0, cap)
}

/** Reader over an in-memory `Uint8Array`, used by the parser path. */
function readerOver(bytes: Uint8Array): GGUFReader {
  return {
    size: () => bytes.length,
    async readBytes(offset, length) {
      if (offset < 0 || offset + length > bytes.length) {
        throw new Error(`Out-of-range read [${offset}, ${offset + length})`)
      }
      return bytes.subarray(offset, offset + length)
    },
  }
}

/**
 * Compose the friendly registry name from parsed metadata and the
 * picked filename. Falls back to the bare filename when metadata
 * doesn't carry a model name.
 */
function deriveDisplayName(meta: DerivedMetadata, fallbackName: string): string {
  if (meta.modelName && meta.modelName.trim().length > 0) return meta.modelName.trim()
  // Strip the .gguf extension and the random uuid prefix from the
  // staged display name.
  const stripped = fallbackName.replace(/\.gguf$/i, '')
  return stripped.length > 0 ? stripped : 'Imported GGUF Model'
}

/** Convert the parser's friendly metadata into the persisted shape. */
function toPersistedMetadata(d: DerivedMetadata): GGUFMetadata {
  return {
    format: 'GGUF',
    version: d.version != null ? String(d.version) : undefined,
    tensorCount: d.tensorCount,
    kvCount: d.kvCount,
    fileType: d.fileType,
    vocabularySize: d.vocabularySize,
    embeddingLength: d.embeddingLength,
    layerCount: d.layerCount,
    headCount: d.headCount,
    headCountKV: d.headCountKV,
    ropeFrequencyBase: d.ropeFrequencyBase,
    ropeScalingType: d.ropeScalingType,
    maxSequenceLength: d.contextLength,
    modelAuthor: d.modelAuthor,
    modelUrl: d.modelUrl,
    modelLicense: d.modelLicense,
  }
}

/**
 * Resolve the best available free-space figure. Prefers the
 * picker-plugin's `StatFs` answer on native; falls back to
 * `navigator.storage.estimate()` on web. Returns null when neither
 * platform answers.
 */
async function probeFreeSpace(): Promise<number | null> {
  if (isNativePickerAvailable()) {
    const v = await getPickerFreeSpaceBytes()
    if (v !== null) return v
  }
  return getStorageFreeSpaceBytes()
}

/**
 * Run the supplied import flow against a picked file. The picked
 * source is either a native staging URI (`file://...`) OR a web `File`
 * carried inside `picked.pickedFile`. On success returns the
 * canonical `GGUFModel`; on failure leaves the KV store untouched and
 * makes a best-effort cleanup of any staged copy.
 */
export async function importFromPicked(picked: PickedGguf): Promise<GGUFModel> {
  if (picked.cancelled) {
    throw new Error('Import cancelled')
  }
  if (!picked.pickedFile && !picked.uri) {
    throw new Error('Picked file has no usable source')
  }

  // Step 1: read the whole file into memory once. On web this comes
  // from the Blob; on native it's a single Filesystem.readFile.
  const bytes = await readAllBytes(picked)
  const fileSize = bytes.length

  // Step 2: parse the header — fast-fail on non-GGUF input before we
  // commit any disk space to the import.
  let parsed
  try {
    parsed = await parseGGUFHeader(readerOver(bytes))
  } catch (err) {
    // Best-effort: clean the staging file if any.
    if (picked.uri) await deleteStagedFile(picked.uri)
    throw new InvalidGGUFError(
      `Selected file is not a valid GGUF model: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // Step 3: free-space guard.
  const free = await probeFreeSpace()
  if (free !== null && free < fileSize * FREE_SPACE_MARGIN) {
    if (picked.uri) await deleteStagedFile(picked.uri)
    throw new LowDiskSpaceError(Math.ceil(fileSize * FREE_SPACE_MARGIN), free)
  }

  // Step 4: SHA-256 → canonical id.
  const sha = await sha256Hex(bytes)
  const targetFilename = `${sha}.gguf`

  // Step 5: idempotency — if this sha is already registered AND the
  // file still exists on disk, return the existing record.
  const existing = (await list()).find((m) => m.id === sha)
  if (existing) {
    if (picked.uri) await deleteStagedFile(picked.uri)
    return existing
  }

  // Step 6: copy the bytes into permanent storage.
  let copied: CopyImportedModelResult
  try {
    copied = await copyImportedModel(picked.uri, targetFilename, {
      sourceBlob: picked.pickedFile,
    })
  } catch (err) {
    if (picked.uri) await deleteStagedFile(picked.uri)
    throw err
  }

  // Step 7: persist the GGUFModel record.
  const meta = parsed.metadata
  const displayName = deriveDisplayName(meta, picked.displayName)
  const now = Date.now()
  const record: GGUFModel = {
    id: sha,
    name: displayName,
    filename: targetFilename,
    path: copied.uri,
    size: copied.bytes || fileSize,
    quantization: meta.fileType ?? 'Unknown',
    architecture: meta.architecture,
    contextLength: meta.contextLength,
    parameterCount: undefined,
    downloadedAt: now,
    metadata: toPersistedMetadata(meta),
  }
  const next = [record, ...(await list())]
  await persist(next)

  // Step 8: best-effort clean-up of the staging file (the picker
  // plugin already wrote it under app-private storage, so a leftover
  // is harmless — but keep storage tidy).
  if (picked.uri) await deleteStagedFile(picked.uri)

  return record
}

/**
 * Idempotently remove a model from the registry and delete its file
 * from app-private storage.
 */
export async function removeById(id: string): Promise<void> {
  const current = await list()
  const target = current.find((m) => m.id === id)
  if (!target) return
  try {
    await deleteModelFile(target.path)
  } catch {
    // Idempotent contract — proceed with KV removal even if the file
    // is gone or the delete failed (the entry is the source of truth).
  }
  const next = current.filter((m) => m.id !== id)
  await persist(next)
}

/** Bump the `lastUsed` timestamp on a record. No-op for missing ids. */
export async function markUsed(id: string): Promise<void> {
  const current = await list()
  const idx = current.findIndex((m) => m.id === id)
  if (idx < 0) return
  const next = [...current]
  next[idx] = { ...next[idx], lastUsed: Date.now() }
  await persist(next)
}

/**
 * Mark the supplied model as active in `LLMRuntimeConfig`. Sets
 * `baseUrl` to the file URI (consumed by the `local-native` provider
 * verbatim, and by the new PR 5 `local-wasm` `file://` /
 * `cache://` modelSource forms — Phase 6) and `defaultModel` to the
 * friendly name. Provider choice is intentionally left alone — the
 * UI surfaces a tip toast when the active provider is HTTP-based.
 */
export async function pickActiveModel(id: string): Promise<GGUFModel> {
  const current = await list()
  const target = current.find((m) => m.id === id)
  if (!target) {
    throw new Error(`No model with id ${id}`)
  }
  await updateLLMRuntimeConfig({
    baseUrl: target.path,
    defaultModel: target.name,
  })
  await markUsed(id)
  // Re-read so we return the row including the bumped lastUsed.
  return (await list()).find((m) => m.id === id) ?? target
}
