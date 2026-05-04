/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Pure-TS GGUF v1 / v2 / v3 header parser.
 *
 * GGUF is the binary container format used by llama.cpp and friends.
 * The on-disk layout is documented at
 * https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
 *
 * Wire format (little-endian throughout):
 *
 *   magic           : u32   = 0x46554747 ('G','G','U','F')
 *   version         : u32   ∈ {1, 2, 3}
 *   tensor_count    : u64 (v2/v3) | u32 (v1)
 *   metadata_kv_count : u64 (v2/v3) | u32 (v1)
 *   for each KV pair:
 *     key_len       : u64 (v2/v3) | u32 (v1)
 *     key           : utf-8 bytes
 *     value_type    : u32 (one of GGUFValueType below)
 *     value         : depends on value_type — recursive for arrays
 *   ... tensors info, then tensor blob ...
 *
 * This module deliberately stops after the metadata KV table — that is
 * enough to surface architecture / context length / quantization /
 * vocab size / model name to the user, and it keeps the read budget
 * to a small constant (≤2 MB even for very rich metadata blocks).
 *
 * The reader interface is generic so the same parser drives:
 *   - a Web `Blob`/`File`               (`createBlobReader`)
 *   - the native filesystem chunked-read adapter from
 *     `src/lib/native/filesystem.ts` (PR 5 phase 2)
 *
 * No external dependencies — everything uses built-in `DataView` /
 * `TextDecoder`.
 */

/** GGUF value type tags as defined in the GGUF spec. */
export const GGUFValueType = {
  UINT8: 0,
  INT8: 1,
  UINT16: 2,
  INT16: 3,
  UINT32: 4,
  INT32: 5,
  FLOAT32: 6,
  BOOL: 7,
  STRING: 8,
  ARRAY: 9,
  UINT64: 10,
  INT64: 11,
  FLOAT64: 12,
} as const

export type GGUFValueTypeName =
  | 'uint8' | 'int8' | 'uint16' | 'int16' | 'uint32' | 'int32'
  | 'float32' | 'float64' | 'uint64' | 'int64'
  | 'bool' | 'string' | 'array'

/** llama.cpp `LLAMA_FTYPE_*` enum → human-readable quantization label. */
const FILE_TYPE_NAMES: Record<number, string> = {
  0: 'F32',
  1: 'F16',
  2: 'Q4_0',
  3: 'Q4_1',
  7: 'Q8_0',
  8: 'Q5_0',
  9: 'Q5_1',
  10: 'Q2_K',
  11: 'Q3_K_S',
  12: 'Q3_K_M',
  13: 'Q3_K_L',
  14: 'Q4_K_S',
  15: 'Q4_K_M',
  16: 'Q5_K_S',
  17: 'Q5_K_M',
  18: 'Q6_K',
  19: 'IQ2_XXS',
  20: 'IQ2_XS',
  21: 'Q2_K_S',
  22: 'IQ3_XS',
  23: 'IQ3_XXS',
  24: 'IQ1_S',
  25: 'IQ4_NL',
  26: 'IQ3_S',
  27: 'IQ3_M',
  28: 'IQ2_S',
  29: 'IQ2_M',
  30: 'IQ4_XS',
  31: 'IQ1_M',
  32: 'BF16',
}

/** GGUF magic = 'GGUF' little-endian u32. */
export const GGUF_MAGIC = 0x46554747

/**
 * Maximum bytes the parser is willing to read for the header + metadata
 * KV table. Real GGUF files keep this comfortably under 1 MB even with
 * full tokenizer vocabularies inlined, so 2 MB is a generous ceiling
 * that still bounds malicious-or-broken-file blast radius.
 */
export const MAX_HEADER_BYTES = 2 * 1024 * 1024

/**
 * Cap on a single string / array length declared in the header. Anything
 * above this is treated as a corrupt or hostile file and rejected.
 */
const MAX_FIELD_BYTES = 16 * 1024 * 1024

/** Cap on a single array's element count (tokenizer vocabs top out ~256k). */
const MAX_ARRAY_LENGTH = 1024 * 1024

/**
 * Generic byte-source contract. `size()` is the total byte length of
 * the underlying file. `readBytes(offset, length)` returns exactly
 * `length` bytes starting at `offset`, or rejects.
 */
export interface GGUFReader {
  size(): number
  readBytes(offset: number, length: number): Promise<Uint8Array>
}

/** Decoded GGUF KV value. */
export type GGUFValue =
  | { type: 'uint8' | 'int8' | 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'float64'; value: number }
  | { type: 'uint64' | 'int64'; value: bigint }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'array'; elementType: GGUFValueTypeName; value: GGUFValue[] }

export interface GGUFKVPair {
  key: string
  value: GGUFValue
}

/** Friendly subset of the metadata. Mirrors `GGUFMetadata` in `src/lib/types.ts`. */
export interface DerivedMetadata {
  format: 'GGUF'
  version: number
  tensorCount: number
  kvCount: number
  architecture?: string
  modelName?: string
  modelAuthor?: string
  modelLicense?: string
  modelUrl?: string
  fileType?: string
  contextLength?: number
  embeddingLength?: number
  layerCount?: number
  headCount?: number
  headCountKV?: number
  ropeFrequencyBase?: number
  ropeScalingType?: string
  tokenizerModel?: string
  vocabularySize?: number
}

export interface ParsedGGUFHeader {
  version: number
  tensorCount: number
  kvCount: number
  /** Bytes consumed reading magic + version + counts + KV table. */
  headerBytesRead: number
  kv: GGUFKVPair[]
  metadata: DerivedMetadata
}

/** Sliding-window byte buffer over a `GGUFReader`. */
class ChunkedCursor {
  private buf: Uint8Array = new Uint8Array(0)
  private bufStartOffset = 0
  private cursor = 0
  private totalRead = 0

  constructor(
    private readonly reader: GGUFReader,
    private readonly maxBytes: number,
    private readonly chunkBytes: number = 64 * 1024,
  ) {}

  position(): number {
    return this.cursor
  }

  async ensure(n: number): Promise<void> {
    if (n < 0) throw new Error(`ChunkedCursor.ensure: negative length ${n}`)
    const have = this.bufStartOffset + this.buf.length - this.cursor
    if (have >= n) return
    if (this.cursor + n > this.reader.size()) {
      throw new GGUFParseError(
        `Truncated GGUF: tried to read ${n} bytes at offset ${this.cursor}, file is ${this.reader.size()} bytes`,
      )
    }
    if (this.totalRead + (n - have) > this.maxBytes) {
      throw new GGUFParseError(
        `GGUF metadata block exceeds the ${this.maxBytes}-byte safety cap`,
      )
    }
    if (this.cursor > this.bufStartOffset) {
      this.buf = this.buf.slice(this.cursor - this.bufStartOffset)
      this.bufStartOffset = this.cursor
    }
    const need = n - this.buf.length
    const fileRemaining = this.reader.size() - (this.bufStartOffset + this.buf.length)
    const fetchSize = Math.min(fileRemaining, Math.max(need, this.chunkBytes))
    if (fetchSize <= 0) {
      throw new GGUFParseError(`ChunkedCursor.ensure: cannot satisfy ${n} bytes`)
    }
    const fetchOffset = this.bufStartOffset + this.buf.length
    const next = await this.reader.readBytes(fetchOffset, fetchSize)
    if (next.length !== fetchSize) {
      throw new GGUFParseError(
        `Reader short read at offset ${fetchOffset}: asked for ${fetchSize}, got ${next.length}`,
      )
    }
    this.totalRead += next.length
    if (this.buf.length === 0) {
      // Defensive copy so a reader returning a long-lived view (e.g.
      // `bytes.subarray`) cannot be mutated under our feet.
      this.buf = new Uint8Array(next)
    } else {
      const merged = new Uint8Array(this.buf.length + next.length)
      merged.set(this.buf, 0)
      merged.set(next, this.buf.length)
      this.buf = merged
    }
    if (this.bufStartOffset + this.buf.length - this.cursor < n) {
      await this.ensure(n)
    }
  }

  async take(n: number): Promise<Uint8Array> {
    await this.ensure(n)
    const start = this.cursor - this.bufStartOffset
    const out = this.buf.subarray(start, start + n)
    this.cursor += n
    return out
  }
}

export class GGUFParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GGUFParseError'
  }
}

const textDecoder = new TextDecoder('utf-8', { fatal: false })

async function readU32(cur: ChunkedCursor): Promise<number> {
  const bytes = await cur.take(4)
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true)
}

async function readU64(cur: ChunkedCursor): Promise<bigint> {
  const bytes = await cur.take(8)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, 8)
  return dv.getBigUint64(0, true)
}

function toFiniteNumber(b: bigint, label: string): number {
  if (b > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new GGUFParseError(`${label} (${b}) exceeds Number.MAX_SAFE_INTEGER`)
  }
  return Number(b)
}

async function readCount(cur: ChunkedCursor, version: number, label: string): Promise<number> {
  if (version === 1) return readU32(cur)
  return toFiniteNumber(await readU64(cur), label)
}

async function readLengthPrefix(
  cur: ChunkedCursor,
  version: number,
  label: string,
): Promise<number> {
  const raw = version === 1 ? BigInt(await readU32(cur)) : await readU64(cur)
  if (raw > BigInt(MAX_FIELD_BYTES)) {
    throw new GGUFParseError(`${label} declared ${raw} bytes (cap ${MAX_FIELD_BYTES})`)
  }
  return toFiniteNumber(raw, label)
}

async function readString(cur: ChunkedCursor, version: number): Promise<string> {
  const len = await readLengthPrefix(cur, version, 'string length')
  if (len === 0) return ''
  const bytes = await cur.take(len)
  return textDecoder.decode(bytes.slice(0))
}

async function readScalar(
  cur: ChunkedCursor,
  type: number,
  version: number,
): Promise<GGUFValue> {
  switch (type) {
    case GGUFValueType.UINT8: {
      const b = await cur.take(1)
      return { type: 'uint8', value: b[0] }
    }
    case GGUFValueType.INT8: {
      const b = await cur.take(1)
      return { type: 'int8', value: new DataView(b.buffer, b.byteOffset, 1).getInt8(0) }
    }
    case GGUFValueType.UINT16: {
      const b = await cur.take(2)
      return { type: 'uint16', value: new DataView(b.buffer, b.byteOffset, 2).getUint16(0, true) }
    }
    case GGUFValueType.INT16: {
      const b = await cur.take(2)
      return { type: 'int16', value: new DataView(b.buffer, b.byteOffset, 2).getInt16(0, true) }
    }
    case GGUFValueType.UINT32: {
      const b = await cur.take(4)
      return { type: 'uint32', value: new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true) }
    }
    case GGUFValueType.INT32: {
      const b = await cur.take(4)
      return { type: 'int32', value: new DataView(b.buffer, b.byteOffset, 4).getInt32(0, true) }
    }
    case GGUFValueType.FLOAT32: {
      const b = await cur.take(4)
      return { type: 'float32', value: new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, true) }
    }
    case GGUFValueType.UINT64: {
      return { type: 'uint64', value: await readU64(cur) }
    }
    case GGUFValueType.INT64: {
      const b = await cur.take(8)
      return { type: 'int64', value: new DataView(b.buffer, b.byteOffset, 8).getBigInt64(0, true) }
    }
    case GGUFValueType.FLOAT64: {
      const b = await cur.take(8)
      return { type: 'float64', value: new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, true) }
    }
    case GGUFValueType.BOOL: {
      const b = await cur.take(1)
      return { type: 'bool', value: b[0] !== 0 }
    }
    case GGUFValueType.STRING: {
      return { type: 'string', value: await readString(cur, version) }
    }
    case GGUFValueType.ARRAY: {
      const elementType = await readU32(cur)
      const elementName = valueTypeName(elementType)
      const lenRaw = version === 1 ? BigInt(await readU32(cur)) : await readU64(cur)
      if (lenRaw > BigInt(MAX_ARRAY_LENGTH)) {
        throw new GGUFParseError(`array length ${lenRaw} exceeds cap ${MAX_ARRAY_LENGTH}`)
      }
      const len = toFiniteNumber(lenRaw, 'array length')
      const out: GGUFValue[] = new Array(len)
      for (let i = 0; i < len; i += 1) {
        out[i] = await readScalar(cur, elementType, version)
      }
      return { type: 'array', elementType: elementName, value: out }
    }
    default:
      throw new GGUFParseError(`Unknown GGUF value type tag: ${type}`)
  }
}

function valueTypeName(tag: number): GGUFValueTypeName {
  switch (tag) {
    case GGUFValueType.UINT8: return 'uint8'
    case GGUFValueType.INT8: return 'int8'
    case GGUFValueType.UINT16: return 'uint16'
    case GGUFValueType.INT16: return 'int16'
    case GGUFValueType.UINT32: return 'uint32'
    case GGUFValueType.INT32: return 'int32'
    case GGUFValueType.FLOAT32: return 'float32'
    case GGUFValueType.FLOAT64: return 'float64'
    case GGUFValueType.UINT64: return 'uint64'
    case GGUFValueType.INT64: return 'int64'
    case GGUFValueType.BOOL: return 'bool'
    case GGUFValueType.STRING: return 'string'
    case GGUFValueType.ARRAY: return 'array'
    default:
      throw new GGUFParseError(`Unknown GGUF value type tag: ${tag}`)
  }
}

function getNumber(kv: GGUFKVPair[], key: string): number | undefined {
  const entry = kv.find((p) => p.key === key)
  if (!entry) return undefined
  const v = entry.value
  switch (v.type) {
    case 'uint8':
    case 'int8':
    case 'uint16':
    case 'int16':
    case 'uint32':
    case 'int32':
    case 'float32':
    case 'float64':
      return v.value
    case 'uint64':
    case 'int64':
      if (v.value > BigInt(Number.MAX_SAFE_INTEGER)) return undefined
      return Number(v.value)
    default:
      return undefined
  }
}

function getString(kv: GGUFKVPair[], key: string): string | undefined {
  const entry = kv.find((p) => p.key === key)
  if (!entry || entry.value.type !== 'string') return undefined
  return entry.value.value
}

function getArrayLength(kv: GGUFKVPair[], key: string): number | undefined {
  const entry = kv.find((p) => p.key === key)
  if (!entry || entry.value.type !== 'array') return undefined
  return entry.value.value.length
}

/** Build the friendly metadata subset from a fully-decoded KV table. */
export function deriveMetadata(
  kv: GGUFKVPair[],
  version: number,
  tensorCount: number,
): DerivedMetadata {
  const arch = getString(kv, 'general.architecture')
  const fileType = getNumber(kv, 'general.file_type')
  const md: DerivedMetadata = {
    format: 'GGUF',
    version,
    tensorCount,
    kvCount: kv.length,
    architecture: arch,
    modelName: getString(kv, 'general.name'),
    modelAuthor: getString(kv, 'general.author'),
    modelLicense: getString(kv, 'general.license'),
    modelUrl: getString(kv, 'general.url') ?? getString(kv, 'general.source.url'),
    fileType:
      fileType !== undefined
        ? FILE_TYPE_NAMES[fileType] ?? `Unknown (${fileType})`
        : undefined,
    tokenizerModel: getString(kv, 'tokenizer.ggml.model'),
    vocabularySize: getArrayLength(kv, 'tokenizer.ggml.tokens'),
  }
  if (arch) {
    md.contextLength = getNumber(kv, `${arch}.context_length`)
    md.embeddingLength = getNumber(kv, `${arch}.embedding_length`)
    md.layerCount = getNumber(kv, `${arch}.block_count`)
    md.headCount = getNumber(kv, `${arch}.attention.head_count`)
    md.headCountKV = getNumber(kv, `${arch}.attention.head_count_kv`)
    md.ropeFrequencyBase = getNumber(kv, `${arch}.rope.freq_base`)
    md.ropeScalingType = getString(kv, `${arch}.rope.scaling.type`)
  }
  return md
}

/**
 * Parse the GGUF magic + version + tensor/KV counts + the entire KV
 * metadata table from the supplied reader. Stops at the start of the
 * tensor-info section.
 */
export async function parseGGUFHeader(reader: GGUFReader): Promise<ParsedGGUFHeader> {
  if (reader.size() < 12) {
    throw new GGUFParseError(`File too small to be GGUF (${reader.size()} bytes)`)
  }
  const cur = new ChunkedCursor(reader, MAX_HEADER_BYTES)
  const magic = await readU32(cur)
  if (magic !== GGUF_MAGIC) {
    throw new GGUFParseError(
      `Not a GGUF file: magic 0x${magic.toString(16)} != 0x${GGUF_MAGIC.toString(16)}`,
    )
  }
  const version = await readU32(cur)
  if (version !== 1 && version !== 2 && version !== 3) {
    throw new GGUFParseError(`Unsupported GGUF version: ${version} (expected 1, 2, or 3)`)
  }
  const tensorCount = await readCount(cur, version, 'tensor_count')
  const kvCount = await readCount(cur, version, 'metadata_kv_count')
  if (kvCount > MAX_ARRAY_LENGTH) {
    throw new GGUFParseError(`metadata_kv_count ${kvCount} exceeds cap ${MAX_ARRAY_LENGTH}`)
  }
  const kv: GGUFKVPair[] = []
  for (let i = 0; i < kvCount; i += 1) {
    const key = await readString(cur, version)
    const valueType = await readU32(cur)
    const value = await readScalar(cur, valueType, version)
    kv.push({ key, value })
  }
  return {
    version,
    tensorCount,
    kvCount,
    headerBytesRead: cur.position(),
    kv,
    metadata: deriveMetadata(kv, version, tensorCount),
  }
}

// ---------------------------------------------------------------------------
// Reader adapters

/** Wrap a Web `Blob` (or `File`) so the parser can read it. */
export function createBlobReader(blob: Blob): GGUFReader {
  return {
    size: () => blob.size,
    async readBytes(offset, length) {
      const slice = blob.slice(offset, offset + length)
      const buf = await slice.arrayBuffer()
      return new Uint8Array(buf)
    },
  }
}

/** Wrap an in-memory `Uint8Array` as a reader. */
export function createBytesReader(bytes: Uint8Array): GGUFReader {
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
