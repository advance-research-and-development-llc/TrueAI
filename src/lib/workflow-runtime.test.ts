import { describe, it, expect, vi } from 'vitest'
import { runWorkflow } from './workflow-runtime'
import type { Workflow } from './workflow-types'
import type { AgentTool } from './types'

function makeWorkflow(partial: Partial<Workflow>): Workflow {
  return {
    id: 'wf-1',
    name: 'test',
    description: '',
    nodes: [],
    edges: [],
    variables: {},
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

describe('runWorkflow', () => {
  it('errors on an empty workflow', async () => {
    const r = await runWorkflow(makeWorkflow({}))
    expect(r.status).toBe('error')
    expect(r.error).toMatch(/no nodes/)
  })

  it('runs a linear start → tool → end pipeline via the toolExecutor', async () => {
    const executeTool = vi.fn(async (tool: AgentTool, input: string) => ({
      success: true,
      output: `tool:${tool}(${input})`,
    }))

    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 't', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'calc', toolName: 'calculator', config: { input: '1+1' } } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e1', source: 's', target: 't' },
        { id: 'e2', source: 't', target: 'e' },
      ],
    })

    const result = await runWorkflow(wf, { toolExecutor: { executeTool } })
    expect(result.status).toBe('completed')
    expect(result.steps.map(s => s.nodeId)).toEqual(['s', 't', 'e'])
    expect(executeTool).toHaveBeenCalledWith('calculator', '1+1')
    expect(result.results.t).toBe('tool:calculator(1+1)')
  })

  it('aborts on the first failing tool node', async () => {
    const executeTool = vi.fn(async () => ({ success: false, output: 'kaboom' }))
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 't', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'x', toolName: 'calculator' } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e1', source: 's', target: 't' },
        { id: 'e2', source: 't', target: 'e' },
      ],
    })

    const r = await runWorkflow(wf, { toolExecutor: { executeTool } })
    expect(r.status).toBe('error')
    // 'end' must NOT have been reached.
    expect(r.steps.map(s => s.nodeId)).toEqual(['s', 't'])
  })

  it('routes a decision node down the true branch when the condition is truthy', async () => {
    const executeTool = vi.fn(async (_t: AgentTool, input: string) => ({ success: true, output: input }))
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 'd', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'gt0', condition: '1 > 0' } },
        { id: 'tT', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'T', toolName: 'datetime', config: { input: 'iso' } } },
        { id: 'tF', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'F', toolName: 'datetime', config: { input: 'iso' } } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e0', source: 's', target: 'd' },
        { id: 'eT', source: 'd', target: 'tT', label: 'true' },
        { id: 'eF', source: 'd', target: 'tF', label: 'false' },
        { id: 'e1', source: 'tT', target: 'e' },
        { id: 'e2', source: 'tF', target: 'e' },
      ],
    })
    const r = await runWorkflow(wf, { toolExecutor: { executeTool } })
    expect(r.status).toBe('completed')
    const visited = r.steps.map(s => s.nodeId)
    expect(visited).toContain('tT')
    expect(visited).not.toContain('tF')
  })

  it('routes a decision node down the false branch when the condition is falsy', async () => {
    const executeTool = vi.fn(async () => ({ success: true, output: 'ok' }))
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 'd', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'no', condition: 'false' } },
        { id: 'tT', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'T', toolName: 'datetime' } },
        { id: 'tF', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'F', toolName: 'datetime' } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e0', source: 's', target: 'd' },
        { id: 'eT', source: 'd', target: 'tT', label: 'true' },
        { id: 'eF', source: 'd', target: 'tF', label: 'false' },
        { id: 'e1', source: 'tT', target: 'e' },
        { id: 'e2', source: 'tF', target: 'e' },
      ],
    })
    const r = await runWorkflow(wf, { toolExecutor: { executeTool } })
    expect(r.status).toBe('completed')
    const visited = r.steps.map(s => s.nodeId)
    expect(visited).toContain('tF')
    expect(visited).not.toContain('tT')
  })

  it('runs an agent node via the injected llm and tracks tokens / models', async () => {
    const llm = vi.fn(async (_prompt: string, _model: string) => 'agent reply')
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 'a', type: 'agent', position: { x: 0, y: 0 }, data: { label: 'A', agentId: 'agent-1' } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e1', source: 's', target: 'a' },
        { id: 'e2', source: 'a', target: 'e' },
      ],
    })

    const r = await runWorkflow(wf, {
      llm,
      resolveAgent: id => ({ id, name: 'A', goal: 'do thing', model: 'test-model' }),
      toolExecutor: { executeTool: vi.fn() },
    })

    expect(r.status).toBe('completed')
    expect(llm).toHaveBeenCalledTimes(1)
    expect(llm.mock.calls[0][1]).toBe('test-model')
    expect(r.modelsUsed).toContain('test-model')
    expect(r.tokensIn).toBeGreaterThan(0)
    expect(r.tokensOut).toBeGreaterThan(0)
  })

  it('enforces the maxSteps cap to bound malformed graphs (cycle)', async () => {
    const executeTool = vi.fn(async () => ({ success: true, output: 'ok' }))
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 't', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'x', toolName: 'datetime' } },
      ],
      edges: [
        { id: 'e1', source: 's', target: 't' },
        // Self-cycle: t → t.
        { id: 'e2', source: 't', target: 't' },
      ],
    })
    const r = await runWorkflow(wf, { toolExecutor: { executeTool }, maxSteps: 5 })
    expect(r.status).toBe('error')
    expect(r.error).toMatch(/max steps/)
    expect(r.steps.length).toBe(5)
  })

  it('iterates a loop node `iterations` times then exits', async () => {
    const executeTool = vi.fn(async () => ({ success: true, output: 'ok' }))
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 'l', type: 'loop', position: { x: 0, y: 0 }, data: { label: 'L', iterations: 3 } },
        { id: 'b', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'body', toolName: 'datetime' } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e0', source: 's', target: 'l' },
        { id: 'e1', source: 'l', target: 'b', label: 'body' },
        { id: 'e2', source: 'l', target: 'e', label: 'exit' },
        // body returns to loop.
        { id: 'e3', source: 'b', target: 'l' },
      ],
    })
    const r = await runWorkflow(wf, { toolExecutor: { executeTool } })
    expect(r.status).toBe('completed')
    // Body should execute exactly 3 times.
    expect(r.steps.filter(s => s.nodeId === 'b').length).toBe(3)
  })

  it('treats an empty / whitespace decision condition as truthy', async () => {
    const executeTool = vi.fn(async () => ({ success: true, output: 'ok' }))
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 'd', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'noop', condition: '   ' } },
        { id: 'tT', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'T', toolName: 'datetime' } },
        { id: 'tF', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'F', toolName: 'datetime' } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e0', source: 's', target: 'd' },
        { id: 'eT', source: 'd', target: 'tT', label: 'true' },
        { id: 'eF', source: 'd', target: 'tF', label: 'false' },
        { id: 'e1', source: 'tT', target: 'e' },
        { id: 'e2', source: 'tF', target: 'e' },
      ],
    })
    const r = await runWorkflow(wf, { toolExecutor: { executeTool } })
    expect(r.steps.map(s => s.nodeId)).toContain('tT')
  })

  it('treats a malformed decision condition as truthy (eval throws → catch)', async () => {
    const executeTool = vi.fn(async () => ({ success: true, output: 'ok' }))
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 'd', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'bad', condition: '((' } },
        { id: 'tT', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'T', toolName: 'datetime' } },
        { id: 'tF', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'F', toolName: 'datetime' } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e0', source: 's', target: 'd' },
        { id: 'eT', source: 'd', target: 'tT', label: 'true' },
        { id: 'eF', source: 'd', target: 'tF', label: 'false' },
        { id: 'e1', source: 'tT', target: 'e' },
        { id: 'e2', source: 'tF', target: 'e' },
      ],
    })
    const r = await runWorkflow(wf, { toolExecutor: { executeTool } })
    expect(r.steps.map(s => s.nodeId)).toContain('tT')
  })

  it('falls back to ordinal edge picking when decision edges are unlabelled', async () => {
    const executeTool = vi.fn(async () => ({ success: true, output: 'ok' }))
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 'd', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'no', condition: 'false' } },
        { id: 'tA', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'A', toolName: 'datetime' } },
        { id: 'tB', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'B', toolName: 'datetime' } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e0', source: 's', target: 'd' },
        // No labels: falsy branch should pick edges[1] = tB.
        { id: 'eA', source: 'd', target: 'tA' },
        { id: 'eB', source: 'd', target: 'tB' },
        { id: 'e1', source: 'tA', target: 'e' },
        { id: 'e2', source: 'tB', target: 'e' },
      ],
    })
    const r = await runWorkflow(wf, { toolExecutor: { executeTool } })
    expect(r.steps.map(s => s.nodeId)).toContain('tB')
  })

  it('fails a tool node missing toolName', async () => {
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 't', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'x' } },
      ],
      edges: [{ id: 'e1', source: 's', target: 't' }],
    })
    const r = await runWorkflow(wf)
    expect(r.status).toBe('error')
    expect(r.error).toMatch(/missing toolName/)
  })

  it('returns error result when an agent node llm rejects', async () => {
    const llm = vi.fn(async () => {
      throw new Error('llm boom')
    })
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 'a', type: 'agent', position: { x: 0, y: 0 }, data: { label: 'A', agentId: 'a-1' } },
      ],
      edges: [{ id: 'e1', source: 's', target: 'a' }],
    })
    const r = await runWorkflow(wf, {
      llm,
      resolveAgent: id => ({ id, model: 'm' }),
    })
    expect(r.status).toBe('error')
    expect(r.error).toMatch(/llm boom/)
  })

  it('passes through unknown node types via the default switch arm', async () => {
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        // Cast to unknown node type to exercise the default branch.
        { id: 'x', type: 'mystery' as unknown as 'tool', position: { x: 0, y: 0 }, data: { label: 'mystery' } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e1', source: 's', target: 'x' },
        { id: 'e2', source: 'x', target: 'e' },
      ],
    })
    const r = await runWorkflow(wf)
    expect(r.status).toBe('completed')
    expect(r.steps.map(s => s.nodeId)).toEqual(['s', 'x', 'e'])
  })

  it('uses globalThis.spark.llm by default when no llm dep is provided', async () => {
    const sparkLlm = vi.fn(async (_p: string, _m: string) => 'spark out')
    const g = globalThis as unknown as { spark?: { llm?: unknown } }
    const prevSpark = g.spark
    g.spark = { ...(prevSpark ?? {}), llm: sparkLlm }
    try {
      const wf = makeWorkflow({
        nodes: [
          { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
          { id: 'a', type: 'agent', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
        ],
        edges: [
          { id: 'e1', source: 's', target: 'a' },
          { id: 'e2', source: 'a', target: 'e' },
        ],
      })
      const r = await runWorkflow(wf)
      expect(r.status).toBe('completed')
      expect(sparkLlm).toHaveBeenCalledTimes(1)
      expect(r.results.a).toBe('spark out')
    } finally {
      g.spark = prevSpark
    }
  })

  it('errors out when no llm dep and no globalThis.spark.llm is available', async () => {
    const g = globalThis as unknown as { spark?: { llm?: unknown } }
    const prevSpark = g.spark
    g.spark = { ...(prevSpark ?? {}), llm: undefined }
    try {
      const wf = makeWorkflow({
        nodes: [
          { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
          { id: 'a', type: 'agent', position: { x: 0, y: 0 }, data: { label: 'A' } },
        ],
        edges: [{ id: 'e1', source: 's', target: 'a' }],
      })
      const r = await runWorkflow(wf)
      expect(r.status).toBe('error')
      expect(r.error).toMatch(/spark\.llm undefined/)
    } finally {
      g.spark = prevSpark
    }
  })

  it('errors when an edge points to a missing node id (dangling edge)', async () => {
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
      ],
      edges: [{ id: 'e1', source: 's', target: 'ghost' }],
    })
    const r = await runWorkflow(wf)
    expect(r.status).toBe('error')
    expect(r.error).toMatch(/dangling edge/)
  })

  it('completes cleanly when a non-end node has no outgoing edges', async () => {
    const executeTool = vi.fn(async () => ({ success: true, output: 'last' }))
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 't', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'x', toolName: 'datetime' } },
      ],
      edges: [{ id: 'e1', source: 's', target: 't' }],
    })
    const r = await runWorkflow(wf, { toolExecutor: { executeTool } })
    expect(r.status).toBe('completed')
    expect(r.results.t).toBe('last')
  })

  it('invokes onStep for every executed node', async () => {
    const executeTool = vi.fn(async () => ({ success: true, output: 'ok' }))
    const onStep = vi.fn()
    const wf = makeWorkflow({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { label: 'start' } },
        { id: 't', type: 'tool', position: { x: 0, y: 0 }, data: { label: 'x', toolName: 'datetime' } },
        { id: 'e', type: 'end', position: { x: 0, y: 0 }, data: { label: 'end' } },
      ],
      edges: [
        { id: 'e1', source: 's', target: 't' },
        { id: 'e2', source: 't', target: 'e' },
      ],
    })
    await runWorkflow(wf, { toolExecutor: { executeTool }, onStep })
    expect(onStep).toHaveBeenCalledTimes(3)
  })
})
