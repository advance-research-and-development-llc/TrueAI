import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  BUILTIN_TOOLS,
  LLM_API_KEY_STORAGE_KEY,
  ToolRegistry,
  createDefaultRegistry,
  hasConfiguredCredential,
  isSensitiveKey,
} from './tool-registry'
import { secureStorage } from '@/lib/native/secure-storage'

describe('isSensitiveKey', () => {
  it.each([
    '__llm_runtime_api_key__',
    '__llm_runtime_api_key__:openai',
    'openai_api_key',
    'OPENAI_API_KEY',
    'github_token',
    'session-secret',
    'user_password',
  ])('flags %s as sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true)
  })

  it.each(['active-tab', 'theme', 'last_query', 'foo', 'cache:doc:123'])(
    'leaves %s alone',
    (key) => {
      expect(isSensitiveKey(key)).toBe(false)
    },
  )
})

describe('ToolRegistry', () => {
  let reg: ToolRegistry

  beforeEach(() => {
    reg = new ToolRegistry()
  })

  it('registers and retrieves a tool', () => {
    reg.register({
      name: 'echo',
      description: 'Echo input.',
      inputSchema: z.object({ msg: z.string() }).strict(),
      execute: ({ msg }) => ({ msg }),
    })
    expect(reg.has('echo')).toBe(true)
    expect(reg.get('echo')?.name).toBe('echo')
    expect(reg.list()).toHaveLength(1)
  })

  it('refuses duplicate registration', () => {
    reg.register({
      name: 'dup',
      description: 'first',
      inputSchema: z.object({}).strict(),
      execute: () => null,
    })
    expect(() =>
      reg.register({
        name: 'dup',
        description: 'second',
        inputSchema: z.object({}).strict(),
        execute: () => null,
      }),
    ).toThrow(/already registered/)
  })

  it('upsert replaces an existing definition', () => {
    reg.register({
      name: 't',
      description: 'first',
      inputSchema: z.object({}).strict(),
      execute: () => 'first',
    })
    reg.upsert({
      name: 't',
      description: 'second',
      inputSchema: z.object({}).strict(),
      execute: () => 'second',
    })
    expect(reg.get('t')?.description).toBe('second')
  })

  it('unregister removes a tool', () => {
    reg.register({
      name: 'gone',
      description: '',
      inputSchema: z.object({}).strict(),
      execute: () => null,
    })
    expect(reg.unregister('gone')).toBe(true)
    expect(reg.unregister('gone')).toBe(false)
    expect(reg.has('gone')).toBe(false)
  })
})

describe('createDefaultRegistry — built-in tools', () => {
  it('seeds three local-first tools', () => {
    const reg = createDefaultRegistry()
    expect(reg.list().map((t) => t.name).sort()).toEqual([
      'currentTime',
      'kvStoreLookup',
      'mathEval',
    ])
  })

  it('all built-ins are zero-network', () => {
    for (const def of BUILTIN_TOOLS) {
      expect(def.requiresNetwork ?? false).toBe(false)
      expect(def.requiresCredential ?? false).toBe(false)
    }
  })

  describe('currentTime', () => {
    it('returns ISO timestamp + IANA zone', async () => {
      const reg = createDefaultRegistry()
      const def = reg.get('currentTime')
      expect(def).toBeDefined()
      const result = (await def!.execute({}, {})) as {
        iso: string
        timestamp: number
        timeZone: string
      }
      expect(result.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(typeof result.timestamp).toBe('number')
      expect(typeof result.timeZone).toBe('string')
    })
  })

  describe('mathEval', () => {
    const cases: Array<[string, number]> = [
      ['1 + 2', 3],
      ['(2 + 3) * 4', 20],
      ['10 / 4', 2.5],
      ['-5 + 8', 3],
      ['2.5 * 4', 10],
      ['((1+2)*(3+4))', 21],
    ]
    it.each(cases)('evaluates %s = %s', async (expr, expected) => {
      const def = createDefaultRegistry().get('mathEval')!
      const result = (await def.execute(
        { expression: expr },
        {},
      )) as { result: number }
      expect(result.result).toBeCloseTo(expected, 10)
    })

    it('rejects non-arithmetic input', () => {
      const def = createDefaultRegistry().get('mathEval')!
      expect(() => def.execute({ expression: 'alert(1)' }, {})).toThrow(
        /unsupported characters/,
      )
    })

    it('rejects division by zero', () => {
      const def = createDefaultRegistry().get('mathEval')!
      expect(() => def.execute({ expression: '1/0' }, {})).toThrow(
        /division by zero/,
      )
    })

    it('rejects malformed parentheses', () => {
      const def = createDefaultRegistry().get('mathEval')!
      expect(() => def.execute({ expression: '(1+2' }, {})).toThrow(
        /parenthesis/,
      )
    })
  })

  describe('kvStoreLookup — credential leak regression', () => {
    // Mirrors the regression-test pattern in
    // src/lib/llm-runtime/kv-store.test.ts: any path that could expose
    // a credential MUST be tested explicitly.

    it('refuses the canonical API key storage key', async () => {
      const def = createDefaultRegistry().get('kvStoreLookup')!
      await expect(
        def.execute({ key: LLM_API_KEY_STORAGE_KEY }, {}),
      ).rejects.toThrow(/refusing to expose sensitive key/)
    })

    it('refuses any key matching the sensitive pattern set', async () => {
      const def = createDefaultRegistry().get('kvStoreLookup')!
      for (const key of [
        'openai_api_key',
        'github_token',
        'user_password',
        'session-secret',
      ]) {
        await expect(def.execute({ key }, {})).rejects.toThrow(
          /sensitive key/,
        )
      }
    })

    it('reads a non-sensitive key normally', async () => {
      const def = createDefaultRegistry().get('kvStoreLookup')!
      const { kvStore } = await import('@/lib/llm-runtime/kv-store')
      await kvStore.set('demo:greeting', 'hello')
      const out = (await def.execute({ key: 'demo:greeting' }, {})) as {
        key: string
        value: unknown
      }
      expect(out).toEqual({ key: 'demo:greeting', value: 'hello' })
    })
  })
})

describe('hasConfiguredCredential', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when secureStorage has no value', async () => {
    vi.spyOn(secureStorage, 'get').mockResolvedValue(undefined)
    expect(await hasConfiguredCredential()).toBe(false)
  })

  it('returns false when secureStorage rejects', async () => {
    vi.spyOn(secureStorage, 'get').mockRejectedValue(new Error('boom'))
    expect(await hasConfiguredCredential()).toBe(false)
  })

  it('returns true for a non-empty string', async () => {
    vi.spyOn(secureStorage, 'get').mockResolvedValue('sk-test')
    expect(await hasConfiguredCredential()).toBe(true)
  })

  it('returns false for an empty string', async () => {
    vi.spyOn(secureStorage, 'get').mockResolvedValue('')
    expect(await hasConfiguredCredential()).toBe(false)
  })
})

describe('ToolRegistry.buildToolSet — gating', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hides network/credential-gated tools when no credential is configured', async () => {
    vi.spyOn(secureStorage, 'get').mockResolvedValue(undefined)
    const reg = createDefaultRegistry()
    reg.register({
      name: 'webSearch',
      description: 'Hosted web search.',
      inputSchema: z.object({ q: z.string() }).strict(),
      requiresNetwork: true,
      requiresCredential: true,
      execute: () => ({ results: [] }),
    })
    const set = await reg.buildToolSet()
    expect(Object.keys(set).sort()).toEqual([
      'currentTime',
      'kvStoreLookup',
      'mathEval',
    ])
    expect(set).not.toHaveProperty('webSearch')
  })

  it('exposes gated tools when a credential is configured', async () => {
    vi.spyOn(secureStorage, 'get').mockResolvedValue('sk-test')
    const reg = createDefaultRegistry()
    reg.register({
      name: 'webSearch',
      description: 'Hosted web search.',
      inputSchema: z.object({ q: z.string() }).strict(),
      requiresNetwork: true,
      execute: () => ({ results: [] }),
    })
    const set = await reg.buildToolSet()
    expect(set).toHaveProperty('webSearch')
  })

  it('forceUnlockGatedTools bypasses the credential check (tests only)', async () => {
    vi.spyOn(secureStorage, 'get').mockResolvedValue(undefined)
    const reg = createDefaultRegistry()
    reg.register({
      name: 'imageGen',
      description: 'Hosted image generation.',
      inputSchema: z.object({ prompt: z.string() }).strict(),
      requiresNetwork: true,
      execute: () => ({ url: 'data:image/png;base64,deadbeef' }),
    })
    const set = await reg.buildToolSet({ forceUnlockGatedTools: true })
    expect(set).toHaveProperty('imageGen')
  })
})
