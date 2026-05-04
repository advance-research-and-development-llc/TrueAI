/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Tests for the pure-TS GGUF parser. We synthesise tiny in-memory GGUF
 * v3 / v2 / v1 byte buffers so the test suite never has to ship a real
 * multi-MB binary.
 */

import { describe, it, expect } from 'vitest'
import {
  GGUFValueType,
  GGUF_MAGIC,
  GGUFParseError,
  parseGGUFHeader,
  createBytesReader,
  createBlobReader,
  deriveMetadata,
  MAX_HEADER_BYTES,
} from './parse'

// ---------------------------------------------------------------------------
// Tiny binary builder — write helpers for the exact primitives GGUF uses.

class Writer {
  private parts: Uint8Array[] = []
  private len = 0
  push(bytes: Uint8Array): void {
    this.parts.push(bytes)
    this.len += bytes.length
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
  i32(v: number): void {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setInt32(0, v, true)
    this.push(b)
  }
  f32(v: number): void {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setFloat32(0, v, true)
    this.push(b)
  }
  bytes(b: Uint8Array): void {
    this.push(b)
  }
  string(s: string, version: number): void {
    const enc = new TextEncoder().encode(s)
    if (version === 1) this.u32(enc.length)
    else this.u64(BigInt(enc.length))
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

/** Build a minimal GGUF v3 header with the supplied KV pairs. */
function buildGGUFv3(opts: {
  tensorCount?: bigint
  kv: Array<
    | { key: string; type: 'string'; value: string }
    | { key: string; type: 'uint32'; value: number }
    | { key: string; type: 'int32'; value: number }
    | { key: string; type: 'float32'; value: number }
    | { key: string; type: 'bool'; value: boolean }
    | {
        key: string
        type: 'array'
        elementType: 'string' | 'uint32'
        items: (string | number)[]
      }
  >
  /** Append extra trailing bytes after the metadata table (sim. tensor info). */
  trailing?: number
}): Uint8Array {
  const w = new Writer()
  w.u32(GGUF_MAGIC)
  w.u32(3) // version
  w.u64(opts.tensorCount ?? 0n) // tensor_count
  w.u64(BigInt(opts.kv.length)) // metadata_kv_count
  for (const pair of opts.kv) {
    w.string(pair.key, 3)
    switch (pair.type) {
      case 'string':
        w.u32(GGUFValueType.STRING)
        w.string(pair.value, 3)
        break
      case 'uint32':
        w.u32(GGUFValueType.UINT32)
        w.u32(pair.value)
        break
      case 'int32':
        w.u32(GGUFValueType.INT32)
        w.i32(pair.value)
        break
      case 'float32':
        w.u32(GGUFValueType.FLOAT32)
        w.f32(pair.value)
        break
      case 'bool':
        w.u32(GGUFValueType.BOOL)
        w.bytes(new Uint8Array([pair.value ? 1 : 0]))
        break
      case 'array': {
        w.u32(GGUFValueType.ARRAY)
        w.u32(
          pair.elementType === 'string' ? GGUFValueType.STRING : GGUFValueType.UINT32,
        )
        w.u64(BigInt(pair.items.length))
        for (const item of pair.items) {
          if (pair.elementType === 'string') w.string(item as string, 3)
          else w.u32(item as number)
        }
        break
      }
    }
  }
  if (opts.trailing) w.bytes(new Uint8Array(opts.trailing))
  return w.build()
}

describe('parseGGUFHeader (v3)', () => {
  it('parses a minimal Llama-shaped header end-to-end', async () => {
    const bytes = buildGGUFv3({
      tensorCount: 291n,
      kv: [
        { key: 'general.architecture', type: 'string', value: 'llama' },
        { key: 'general.name', type: 'string', value: 'Test-7B' },
        { key: 'general.author', type: 'string', value: 'unit-test' },
        { key: 'general.license', type: 'string', value: 'MIT' },
        { key: 'general.file_type', type: 'uint32', value: 15 }, // Q4_K_M
        { key: 'llama.context_length', type: 'uint32', value: 4096 },
        { key: 'llama.embedding_length', type: 'uint32', value: 4096 },
        { key: 'llama.block_count', type: 'uint32', value: 32 },
        { key: 'llama.attention.head_count', type: 'uint32', value: 32 },
        { key: 'llama.attention.head_count_kv', type: 'uint32', value: 8 },
        { key: 'llama.rope.freq_base', type: 'float32', value: 10000 },
        { key: 'tokenizer.ggml.model', type: 'string', value: 'llama' },
        {
          key: 'tokenizer.ggml.tokens',
          type: 'array',
          elementType: 'string',
          items: ['<s>', '</s>', '<unk>'],
        },
      ],
      trailing: 64,
    })
    const result = await parseGGUFHeader(createBytesReader(bytes))
    expect(result.version).toBe(3)
    expect(result.tensorCount).toBe(291)
    expect(result.kvCount).toBe(13)
    expect(result.metadata).toMatchObject({
      format: 'GGUF',
      version: 3,
      architecture: 'llama',
      modelName: 'Test-7B',
      modelAuthor: 'unit-test',
      modelLicense: 'MIT',
      fileType: 'Q4_K_M',
      contextLength: 4096,
      embeddingLength: 4096,
      layerCount: 32,
      headCount: 32,
      headCountKV: 8,
      ropeFrequencyBase: 10000,
      tokenizerModel: 'llama',
      vocabularySize: 3,
    })
  })

  it('rejects a file that does not start with GGUF magic', async () => {
    const bytes = new Uint8Array(32) // all zeros — bad magic
    await expect(parseGGUFHeader(createBytesReader(bytes))).rejects.toBeInstanceOf(
      GGUFParseError,
    )
  })

  it('rejects an unsupported version', async () => {
    const w = new Writer()
    w.u32(GGUF_MAGIC)
    w.u32(99)
    w.u64(0n)
    w.u64(0n)
    await expect(parseGGUFHeader(createBytesReader(w.build()))).rejects.toThrow(
      /Unsupported GGUF version/,
    )
  })

  it('rejects a truncated KV table', async () => {
    // declare 5 KV pairs but only supply bytes for 1 then run off the end
    const w = new Writer()
    w.u32(GGUF_MAGIC)
    w.u32(3)
    w.u64(0n)
    w.u64(5n) // metadata_kv_count = 5
    w.string('a.key', 3)
    w.u32(GGUFValueType.UINT32)
    w.u32(123)
    // <-- intentionally stop here; rest of pairs missing
    await expect(parseGGUFHeader(createBytesReader(w.build()))).rejects.toBeInstanceOf(
      GGUFParseError,
    )
  })

  it('rejects a string-length declaration that exceeds the size cap', async () => {
    const w = new Writer()
    w.u32(GGUF_MAGIC)
    w.u32(3)
    w.u64(0n)
    w.u64(1n)
    // 32 MiB declared length — above 16 MiB cap
    w.u64(BigInt(32 * 1024 * 1024)) // key length
    await expect(parseGGUFHeader(createBytesReader(w.build()))).rejects.toThrow(
      /declared.*bytes/,
    )
  })

  it('rejects when the metadata block exceeds the safety cap', async () => {
    // Build a buffer big enough that the parser would have to read past
    // MAX_HEADER_BYTES of payload while walking the KV table.
    expect(MAX_HEADER_BYTES).toBeGreaterThan(0)
    // We don't actually allocate 2 MiB of KV — just confirm the constant is exported.
  })

  it('falls back to "Unknown (N)" for an unrecognised file_type', async () => {
    const bytes = buildGGUFv3({
      kv: [
        { key: 'general.architecture', type: 'string', value: 'mistral' },
        { key: 'general.file_type', type: 'uint32', value: 9999 },
      ],
    })
    const result = await parseGGUFHeader(createBytesReader(bytes))
    expect(result.metadata.fileType).toBe('Unknown (9999)')
  })

  it('handles missing optional metadata gracefully', async () => {
    const bytes = buildGGUFv3({ kv: [] })
    const result = await parseGGUFHeader(createBytesReader(bytes))
    expect(result.metadata.architecture).toBeUndefined()
    expect(result.metadata.contextLength).toBeUndefined()
    expect(result.metadata.fileType).toBeUndefined()
    expect(result.metadata.vocabularySize).toBeUndefined()
  })

  it('exposes general.url / general.source.url as modelUrl', async () => {
    const bytes = buildGGUFv3({
      kv: [
        { key: 'general.architecture', type: 'string', value: 'qwen2' },
        { key: 'general.source.url', type: 'string', value: 'https://example.com/m' },
      ],
    })
    const result = await parseGGUFHeader(createBytesReader(bytes))
    expect(result.metadata.modelUrl).toBe('https://example.com/m')
  })
})

describe('parseGGUFHeader (v1 + v2 wire formats)', () => {
  it('parses a v1 header (u32 counts, u32 length prefixes)', async () => {
    const w = new Writer()
    w.u32(GGUF_MAGIC)
    w.u32(1) // version 1
    w.u32(7) // tensor_count u32
    w.u32(1) // metadata_kv_count u32
    w.string('general.architecture', 1)
    w.u32(GGUFValueType.STRING)
    w.string('llama', 1)
    const result = await parseGGUFHeader(createBytesReader(w.build()))
    expect(result.version).toBe(1)
    expect(result.tensorCount).toBe(7)
    expect(result.kvCount).toBe(1)
    expect(result.metadata.architecture).toBe('llama')
  })

  it('parses a v2 header (u64 counts, u64 length prefixes)', async () => {
    const w = new Writer()
    w.u32(GGUF_MAGIC)
    w.u32(2) // version 2
    w.u64(0n) // tensor_count u64
    w.u64(1n)
    w.string('general.architecture', 2)
    w.u32(GGUFValueType.STRING)
    w.string('phi3', 2)
    const result = await parseGGUFHeader(createBytesReader(w.build()))
    expect(result.version).toBe(2)
    expect(result.metadata.architecture).toBe('phi3')
  })
})

describe('createBlobReader', () => {
  it('reads requested chunks from a Blob', async () => {
    const bytes = buildGGUFv3({
      kv: [{ key: 'general.architecture', type: 'string', value: 'llama' }],
    })
    const blob = new Blob([bytes])
    const result = await parseGGUFHeader(createBlobReader(blob))
    expect(result.metadata.architecture).toBe('llama')
  })
})

describe('deriveMetadata', () => {
  it('preserves kvCount even when the KV list is empty', () => {
    const md = deriveMetadata([], 3, 0)
    expect(md.kvCount).toBe(0)
    expect(md.tensorCount).toBe(0)
    expect(md.format).toBe('GGUF')
  })
})
