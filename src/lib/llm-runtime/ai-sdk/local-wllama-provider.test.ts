import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetLocalWllamaForTests,
  createLocalWllamaModel,
} from './local-wllama-provider'

interface FakeChunk {
  token: number
  piece: Uint8Array
  currentText: string
}

function makeIterable(parts: string[]): AsyncIterable<FakeChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      let acc = ''
      for (let i = 0; i < parts.length; i++) {
        acc += parts[i]
        yield {
          token: i + 1,
          piece: new TextEncoder().encode(parts[i]),
          currentText: acc,
        }
      }
    },
  }
}

const loadModelFromUrl = vi.fn(async () => {})
const loadModelFromHF = vi.fn(async () => {})
const createChatCompletion = vi.fn(
  async (_messages: unknown, opts: { stream?: boolean }) => {
    if (opts?.stream) return makeIterable(['hel', 'lo', ' world'])
    return 'hello world'
  },
)

class FakeWllama {
  // Receive whatever assets path the adapter passes through.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public assets: any) {}
  isModelLoaded() {
    return true
  }
  loadModelFromUrl = loadModelFromUrl
  loadModelFromHF = loadModelFromHF
  createChatCompletion = createChatCompletion
}

vi.mock('@wllama/wllama', () => ({ Wllama: FakeWllama }))

describe('local-wllama-provider', () => {
  beforeEach(() => {
    __resetLocalWllamaForTests()
    loadModelFromUrl.mockClear()
    loadModelFromHF.mockClear()
    createChatCompletion.mockClear()
  })

  afterEach(() => {
    __resetLocalWllamaForTests()
  })

  it('rejects calls when no model source is configured', async () => {
    const model = createLocalWllamaModel({ modelSource: '', modelId: 'm' })
    await expect(
      model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      }),
    ).rejects.toThrow(/no model source is configured/i)
  })

  it('loads via loadModelFromUrl for plain URLs and reports the configured modelId', async () => {
    const model = createLocalWllamaModel({
      modelSource: 'https://example.test/m.gguf',
      modelId: 'my-model',
    })
    expect(model.specificationVersion).toBe('v3')
    expect(model.provider).toBe('local-wasm')
    expect(model.modelId).toBe('my-model')
    const result = await model.doGenerate({
      prompt: [
        { role: 'system', content: 'you are helpful' },
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      ],
    })
    expect(loadModelFromUrl).toHaveBeenCalledWith('https://example.test/m.gguf')
    expect(loadModelFromHF).not.toHaveBeenCalled()
    expect(result.content).toEqual([{ type: 'text', text: 'hello world' }])
    expect(result.finishReason).toEqual({ unified: 'stop', raw: undefined })
    // System + user message both passed through.
    const [messages] = createChatCompletion.mock.calls[0]
    expect(messages).toEqual([
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'hi' },
    ])
  })

  it('loads via loadModelFromHF for hf: shortcuts', async () => {
    const model = createLocalWllamaModel({
      modelSource: 'hf:Mozilla/Llama-3.2-1B-Instruct-llamafile:Llama-3.2-1B-Instruct.Q4_K_M.gguf',
      modelId: 'llama-3.2',
    })
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    expect(loadModelFromHF).toHaveBeenCalledWith(
      'Mozilla/Llama-3.2-1B-Instruct-llamafile',
      'Llama-3.2-1B-Instruct.Q4_K_M.gguf',
    )
    expect(loadModelFromUrl).not.toHaveBeenCalled()
  })

  it('rejects malformed hf: shortcuts with a clear error', async () => {
    const model = createLocalWllamaModel({
      modelSource: 'hf:no-colon-after-repo',
      modelId: 'm',
    })
    await expect(
      model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      }),
    ).rejects.toThrow(/invalid hf: shortcut/i)
  })

  it('reuses the cached instance on subsequent calls with the same source', async () => {
    const model = createLocalWllamaModel({
      modelSource: 'https://example.test/m.gguf',
      modelId: 'm',
    })
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'a' }] }],
    })
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'b' }] }],
    })
    // Loaded exactly once.
    expect(loadModelFromUrl).toHaveBeenCalledTimes(1)
    expect(createChatCompletion).toHaveBeenCalledTimes(2)
  })

  it('streams text-delta parts that concatenate to the full response', async () => {
    const model = createLocalWllamaModel({
      modelSource: 'https://example.test/m.gguf',
      modelId: 'm',
    })
    const { stream } = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    const reader = stream.getReader()
    const parts: { type: string; delta?: string }[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value as { type: string; delta?: string })
    }
    const types = parts.map((p) => p.type)
    expect(types[0]).toBe('stream-start')
    expect(types).toContain('text-start')
    expect(types).toContain('text-end')
    expect(types[types.length - 1]).toBe('finish')
    const deltas = parts
      .filter((p) => p.type === 'text-delta')
      .map((p) => p.delta ?? '')
      .join('')
    expect(deltas).toBe('hello world')
  })

  it('emits an error stream part when the underlying generator throws', async () => {
    createChatCompletion.mockImplementationOnce(
      async (_m: unknown, opts: { stream?: boolean }) => {
        if (opts?.stream) {
          // Async iterable that throws on first iteration.
          return {
            async *[Symbol.asyncIterator]() {
              throw new Error('boom')
              yield { token: 0, piece: new Uint8Array(), currentText: '' }
            },
          }
        }
        return ''
      },
    )
    const model = createLocalWllamaModel({
      modelSource: 'https://example.test/m.gguf',
      modelId: 'm',
    })
    const { stream } = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    const reader = stream.getReader()
    const types: string[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      types.push((value as { type: string }).type)
    }
    expect(types).toContain('error')
  })

  it('passes sampling parameters through to wllama', async () => {
    const model = createLocalWllamaModel({
      modelSource: 'https://example.test/m.gguf',
      modelId: 'm',
      maxOutputTokens: 256,
    })
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      temperature: 0.5,
      topP: 0.8,
      topK: 20,
      frequencyPenalty: 0.2,
    })
    const [, opts] = createChatCompletion.mock.calls[0]
    expect(opts).toMatchObject({
      nPredict: 256,
      stream: false,
      sampling: { temp: 0.5, top_p: 0.8, top_k: 20 },
    })
    // frequencyPenalty 0.2 → penalty_repeat 1.2
    expect(
      (opts as { sampling: { penalty_repeat?: number } }).sampling.penalty_repeat,
    ).toBeCloseTo(1.2)
  })

  it('drops non-text content parts and surfaces a warning on the stream', async () => {
    const model = createLocalWllamaModel({
      modelSource: 'https://example.test/m.gguf',
      modelId: 'm',
    })
    const { stream } = await model.doStream({
      prompt: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'describe this' },
            // file part (image) — must be dropped with a warning
            {
              type: 'file',
              mediaType: 'image/png',
              data: new Uint8Array([1, 2, 3]),
            },
          ],
        },
      ],
    })
    const reader = stream.getReader()
    const first = await reader.read()
    expect(first.value).toMatchObject({ type: 'stream-start' })
    const warnings = (
      first.value as { warnings: Array<{ message?: string }> }
    ).warnings
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0].message).toMatch(/non-text parts/i)
    // Drain the rest so the stream is fully consumed.
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }
    // The text-only content was forwarded to wllama.
    const [messages] = createChatCompletion.mock.calls[0]
    expect(messages).toEqual([{ role: 'user', content: 'describe this' }])
  })
})
