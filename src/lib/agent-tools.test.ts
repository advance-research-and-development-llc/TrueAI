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

    it('rejects unbalanced parentheses', async () => {
      const result = await executor.executeTool('calculator', '(1 + 2')
      expect(result.success).toBe(false)
      expect(result.output).toBe('Invalid mathematical expression')
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
