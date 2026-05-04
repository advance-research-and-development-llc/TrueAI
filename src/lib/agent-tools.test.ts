import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AgentToolExecutor, getToolCategory, getToolDescription } from './agent-tools'

describe('AgentToolExecutor', () => {
  let executor: AgentToolExecutor

  beforeEach(() => {
    executor = new AgentToolExecutor()
  })

  describe('calculator', () => {
    it('evaluates a safe arithmetic expression', async () => {
      const result = await executor.executeTool('calculator', '2 + 3 * 4')
      expect(result.success).toBe(true)
      expect(result.output).toBe('Result: 14')
      expect(result.metadata?.result).toBe(14)
    })

    it('strips dangerous characters before evaluating', async () => {
      // Letters are stripped, leaving "(2+3)" — verifies the sanitiser
      // rejects code-injection attempts cleanly rather than executing them.
      const result = await executor.executeTool('calculator', 'alert+(2+3)')
      expect(result.success).toBe(true)
      expect(result.output).toBe('Result: 5')
    })

    it('rejects trailing input after a valid expression', async () => {
      // Forces parseExpression to return then i !== cleaned.length (line 182-183).
      // Use only valid chars so the sanitiser doesn't strip anything.
      const result = await executor.executeTool('calculator', '(1+2))')
      expect(result.success).toBe(false)
      expect(result.output).toBe('Invalid mathematical expression')
    })

    it('rejects results that are not finite (e.g. division by zero)', async () => {
      // 1/0 → Infinity, fails the isFinite check at lines 185-186.
      const result = await executor.executeTool('calculator', '1/0')
      expect(result.success).toBe(false)
      expect(result.output).toBe('Invalid mathematical expression')
    })

    // Sandbox-hardening regression suite. The previous calculator
    // implementation routed sanitised input through `new Function(...)`,
    // which — even with a pre-sanitiser — kept globals reachable as a
    // sink for any character class that slipped through. The
    // recursive-descent parser closes over a numeric grammar, so even
    // if a future regex change accidentally permits letters, there is
    // no path from tool input to `fetch`, `localStorage`, `window`,
    // `process`, or `globalThis`.
    describe('sandbox hardening — no global / eval reachability', () => {
      it('source no longer contains a Function or eval reference', async () => {
        const fs = await import('node:fs/promises')
        const url = await import('node:url')
        const path = await import('node:path')
        const here = path.dirname(url.fileURLToPath(import.meta.url))
        const src = await fs.readFile(
          path.join(here, 'agent-tools.ts'),
          'utf8',
        )
        // A bare `eval(` or `new Function(` call would re-introduce
        // the sink. Comments referring to them by name are fine.
        const codeOnly = src.replace(/\/\/[^\n]*/g, '')
        expect(codeOnly).not.toMatch(/\beval\s*\(/)
        expect(codeOnly).not.toMatch(/\bnew\s+Function\s*\(/)
      })

      it('cannot reach fetch even when sanitiser is bypassed', async () => {
        // The sanitiser strips letters, so 'fetch' becomes ''. Pass an
        // empty expression to force the parser path; it must throw.
        const result = await executor.executeTool('calculator', 'fetch')
        expect(result.success).toBe(false)
        expect(result.output).toBe('Invalid mathematical expression')
      })

      it('cannot reach window/localStorage/process via numeric injection', async () => {
        // Each of these inputs would, in a Function-constructor
        // implementation, have either evaluated to an object reference
        // or thrown a ReferenceError that escaped to the caller. The
        // parser instead refuses anything that isn't pure arithmetic.
        const inputs = [
          'window.fetch()',
          'localStorage.getItem("x")',
          'process.env',
          'globalThis.fetch',
          'this.constructor("return process")()',
        ]
        for (const inp of inputs) {
          const result = await executor.executeTool('calculator', inp)
          // Either the sanitised version is empty / unparseable, or it
          // collapses to harmless arithmetic. The output is NEVER
          // anything other than 'Invalid mathematical expression' or a
          // numeric Result line — never an object, never a function,
          // never a thrown reference error from the sandbox.
          expect(result.output === 'Invalid mathematical expression' || /^Result: -?\d/.test(result.output)).toBe(true)
        }
      })

      it('rejects empty expressions cleanly', async () => {
        const result = await executor.executeTool('calculator', '')
        expect(result.success).toBe(false)
        expect(result.output).toBe('Invalid mathematical expression')
      })

      it('rejects division by zero', async () => {
        const result = await executor.executeTool('calculator', '1 / 0')
        expect(result.success).toBe(false)
        expect(result.output).toBe('Invalid mathematical expression')
      })

      it('still evaluates legitimate expressions correctly', async () => {
        const cases: Array<[string, number]> = [
          ['1 + 2 * 3', 7],
          ['(1 + 2) * 3', 9],
          ['-5 + 8', 3],
          ['2.5 * 4', 10],
          ['((1+2)*(3+4))', 21],
          ['10 / 4', 2.5],
        ]
        for (const [expr, expected] of cases) {
          const result = await executor.executeTool('calculator', expr)
          expect(result.success).toBe(true)
          expect(result.metadata?.result).toBeCloseTo(expected, 10)
        }
      })
    })
  })

  describe('datetime', () => {
    it('returns the current ISO timestamp on request', async () => {
      const result = await executor.executeTool('datetime', 'iso')
      expect(result.success).toBe(true)
      expect(result.output).toMatch(/Current iso: \d{4}-\d{2}-\d{2}T/)
      expect(typeof result.metadata?.timestamp).toBe('number')
    })

    it('falls back to "current" for unknown ops', async () => {
      const result = await executor.executeTool('datetime', 'not-a-real-op')
      expect(result.success).toBe(true)
      expect(result.metadata?.operation).toBe('not-a-real-op')
    })
  })

  describe('memory', () => {
    type SparkKvMock = { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> }
    const sparkKv = (globalThis as unknown as { spark: { kv: SparkKvMock } }).spark.kv

    beforeEach(() => {
      sparkKv.get.mockReset()
      sparkKv.set.mockReset()
    })

    it('stores data and updates the index', async () => {
      sparkKv.get.mockResolvedValue([])

      const result = await executor.executeTool('memory', 'store: hello world')
      expect(result.success).toBe(true)
      expect(result.output).toBe('Data stored in memory successfully')
      // Two writes: the entry itself and the index update
      expect(sparkKv.set).toHaveBeenCalledTimes(2)
    })

    it('recalls recent entries via the index', async () => {
      sparkKv.get
        .mockResolvedValueOnce(['agent-memory-1', 'agent-memory-2'])
        .mockResolvedValueOnce('first')
        .mockResolvedValueOnce('second')

      const result = await executor.executeTool('memory', 'recall')
      expect(result.success).toBe(true)
      expect(result.output).toContain('first')
      expect(result.output).toContain('second')
    })

    it('rejects unknown commands', async () => {
      const result = await executor.executeTool('memory', 'forget everything')
      expect(result.success).toBe(false)
    })
  })

  describe('json_parser', () => {
    it('summarises a parsed object', async () => {
      const result = await executor.executeTool('json_parser', '{"a":1,"b":2}')
      expect(result.success).toBe(true)
      expect(result.output).toContain('2 top-level keys')
      expect(result.metadata?.keyCount).toBe(2)
    })

    it('reports invalid JSON', async () => {
      const result = await executor.executeTool('json_parser', 'not json')
      expect(result.success).toBe(false)
      expect(result.output).toBe('Invalid JSON format')
    })
  })

  describe('data_analyzer', () => {
    it('computes stats for a numeric array', async () => {
      const result = await executor.executeTool('data_analyzer', '[1, 2, 3, 4]')
      expect(result.success).toBe(true)
      expect(result.output).toContain('Average: 2.50')
      expect(result.output).toContain('Max: 4')
      expect(result.output).toContain('Min: 1')
    })
  })

  describe('sentiment_analyzer', () => {
    it('detects positive sentiment', async () => {
      const result = await executor.executeTool('sentiment_analyzer', 'this is great and wonderful')
      expect(result.success).toBe(true)
      expect(result.metadata?.sentiment).toBe('positive')
    })

    it('detects negative sentiment', async () => {
      const result = await executor.executeTool('sentiment_analyzer', 'this is terrible and awful')
      expect(result.success).toBe(true)
      expect(result.metadata?.sentiment).toBe('negative')
    })
  })

  describe('summarizer', () => {
    it('truncates long input to its first sentences', async () => {
      const long = 'one. two. three. four. five.'
      const result = await executor.executeTool('summarizer', long)
      expect(result.success).toBe(true)
      expect(result.output).toMatch(/one\.\s+two\.\.\./)
    })
  })

  describe('validator', () => {
    it('detects an email', async () => {
      const result = await executor.executeTool('validator', 'user@example.com')
      expect(result.success).toBe(true)
      expect((result.metadata?.validTypes as string[]).includes('email')).toBe(true)
    })

    it('detects a URL', async () => {
      const result = await executor.executeTool('validator', 'https://example.com/x')
      expect(result.success).toBe(true)
      expect((result.metadata?.validTypes as string[]).includes('url')).toBe(true)
    })
  })

  describe('web_search', () => {
    it('fails-closed in the local-first runtime', async () => {
      const result = await executor.executeTool('web_search', 'AI agents')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/unavailable/i)
      expect(result.metadata?.reason).toBe('no-provider')
    })
  })

  describe('image_generator', () => {
    it('fails-closed in the local-first runtime', async () => {
      const result = await executor.executeTool('image_generator', 'a sunset')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/unavailable/i)
      expect(result.metadata?.reason).toBe('no-provider')
    })
  })

  describe('translator', () => {
    it('rejects malformed input', async () => {
      const result = await executor.executeTool('translator', 'no separator here')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/Format/)
    })

    it('fails-closed for valid input in the local-first runtime', async () => {
      const result = await executor.executeTool('translator', 'hello | es')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/unavailable/i)
      expect(result.metadata?.reason).toBe('no-provider')
    })
  })

  describe('file_reader', () => {
    it('rejects empty input', async () => {
      const result = await executor.executeTool('file_reader', '   ')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/empty path/)
    })

    it('rejects parent-dir traversal', async () => {
      const result = await executor.executeTool('file_reader', '../etc/passwd')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/relative.*sandbox/)
    })

    it('rejects absolute paths', async () => {
      const result = await executor.executeTool('file_reader', '/etc/hosts')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/relative.*sandbox/)
    })

    it('reads via fetch on web for a relative path', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('hello world'),
      } as unknown as Response)
      const originalFetch = globalThis.fetch
      globalThis.fetch = fetchMock as unknown as typeof fetch
      try {
        const result = await executor.executeTool('file_reader', 'data/sample.txt')
        expect(result.success).toBe(true)
        expect(result.output).toBe('hello world')
        expect(result.metadata?.source).toBe('fetch')
        expect(fetchMock).toHaveBeenCalledWith('/data/sample.txt')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('reports non-2xx fetch responses', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(''),
      } as unknown as Response)
      const originalFetch = globalThis.fetch
      globalThis.fetch = fetchMock as unknown as typeof fetch
      try {
        const result = await executor.executeTool('file_reader', 'missing.txt')
        expect(result.success).toBe(false)
        expect(result.output).toContain('404')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('reports a fetch that throws (catch branch, lines 351-354)', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
      const originalFetch = globalThis.fetch
      globalThis.fetch = fetchMock as unknown as typeof fetch
      try {
        const result = await executor.executeTool('file_reader', 'data/x.txt')
        expect(result.success).toBe(false)
        expect(result.output).toMatch(/file_reader failed: network down/)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('fails closed when fetch is undefined (line 327)', async () => {
      const originalFetch = globalThis.fetch
      // @ts-expect-error — deliberately remove fetch for this test
      delete globalThis.fetch
      try {
        const result = await executor.executeTool('file_reader', 'data/x.txt')
        expect(result.success).toBe(false)
        expect(result.output).toMatch(/fetch is unavailable/)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('api_caller', () => {
    it('rejects empty input', async () => {
      const result = await executor.executeTool('api_caller', '   ')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/empty input/)
    })

    it('rejects invalid URLs', async () => {
      const result = await executor.executeTool('api_caller', 'not a url')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/invalid URL/)
    })

    it('rejects non-https schemes (SSRF guard)', async () => {
      const result = await executor.executeTool('api_caller', 'http://localhost:8080/admin')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/only https/)
    })

    it('issues a real GET and reports status', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('{"ok":true}'),
      } as unknown as Response)
      const originalFetch = globalThis.fetch
      globalThis.fetch = fetchMock as unknown as typeof fetch
      try {
        const result = await executor.executeTool('api_caller', 'https://example.com/api/x')
        expect(result.success).toBe(true)
        expect(result.metadata?.method).toBe('GET')
        expect(result.metadata?.status).toBe(200)
        expect(result.output).toContain('200 OK')
        expect(result.output).toContain('{"ok":true}')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('parses POST <url> | <body> and forwards the body', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
        text: () => Promise.resolve(''),
      } as unknown as Response)
      const originalFetch = globalThis.fetch
      globalThis.fetch = fetchMock as unknown as typeof fetch
      try {
        const result = await executor.executeTool(
          'api_caller',
          'POST https://example.com/api/items | {"name":"x"}',
        )
        expect(result.success).toBe(true)
        expect(result.metadata?.method).toBe('POST')
        const callArgs = fetchMock.mock.calls[0]
        expect(callArgs[0]).toBe('https://example.com/api/items')
        expect((callArgs[1] as RequestInit).method).toBe('POST')
        expect((callArgs[1] as RequestInit).body).toBe('{"name":"x"}')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('reports an aborted (timed-out) fetch as such', async () => {
      const abortErr = new Error('aborted')
      abortErr.name = 'AbortError'
      const fetchMock = vi.fn().mockRejectedValue(abortErr)
      const originalFetch = globalThis.fetch
      globalThis.fetch = fetchMock as unknown as typeof fetch
      try {
        const result = await executor.executeTool('api_caller', 'https://example.com/slow')
        expect(result.success).toBe(false)
        expect(result.output).toMatch(/timed out after \d+ms/)
        expect(result.metadata?.aborted).toBe(true)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('reports a generic fetch failure (catch branch, line 464)', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('socket reset'))
      const originalFetch = globalThis.fetch
      globalThis.fetch = fetchMock as unknown as typeof fetch
      try {
        const result = await executor.executeTool('api_caller', 'https://example.com/oops')
        expect(result.success).toBe(false)
        expect(result.output).toMatch(/api_caller failed: socket reset/)
        expect(result.metadata?.aborted).toBe(false)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('fails closed when fetch is undefined (line 433)', async () => {
      const originalFetch = globalThis.fetch
      // @ts-expect-error — deliberately remove fetch for this test
      delete globalThis.fetch
      try {
        const result = await executor.executeTool('api_caller', 'https://example.com/x')
        expect(result.success).toBe(false)
        expect(result.output).toMatch(/fetch is unavailable/)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('data_analyzer (additional)', () => {
    it('reports mixed-type arrays without computing stats (line 487)', async () => {
      const result = await executor.executeTool(
        'data_analyzer',
        JSON.stringify(['a', 'b', true]),
      )
      expect(result.success).toBe(true)
      expect(result.output).toMatch(/Array contains 3 items of mixed types/)
    })

    it('summarises object input by key set (lines 489-490)', async () => {
      const result = await executor.executeTool(
        'data_analyzer',
        JSON.stringify({ alpha: 1, beta: 2 }),
      )
      expect(result.success).toBe(true)
      expect(result.output).toMatch(/Object has 2 properties: alpha, beta/)
      expect(result.metadata?.dataType).toBe('object')
    })
  })

  describe('code_interpreter', () => {
    it('is disabled for security', async () => {
      const result = await executor.executeTool('code_interpreter', 'console.log(1)')
      expect(result.success).toBe(false)
      expect(result.output).toMatch(/disabled for security/i)
    })
  })

  describe('unknown tool', () => {
    it('returns a failure for an unsupported tool name', async () => {
      const result = await executor.executeTool(
        'not_a_tool' as Parameters<AgentToolExecutor['executeTool']>[0],
        'x',
      )
      expect(result.success).toBe(false)
      expect(result.output).toContain('Unknown tool')
    })
  })
})

describe('tool metadata helpers', () => {
  it('returns a description for every known tool', () => {
    expect(getToolDescription('calculator')).toMatch(/mathematical/i)
    expect(getToolDescription('datetime')).toMatch(/date/i)
  })

  it('categorises tools', () => {
    expect(getToolCategory('calculator')).toBe('computation')
    expect(getToolCategory('memory')).toBe('data')
    expect(getToolCategory('web_search')).toBe('communication')
    expect(getToolCategory('image_generator')).toBe('generation')
    expect(getToolCategory('sentiment_analyzer')).toBe('analysis')
  })
})
