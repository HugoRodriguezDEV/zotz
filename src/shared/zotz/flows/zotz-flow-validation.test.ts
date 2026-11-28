import { describe, expect, it } from 'vitest'
import type { ZotzFlowEdge } from './zotz-flow-contract'
import type { ZotzFlowNode } from './zotz-flow-node-contract'
import { validateZotzFlow } from './zotz-flow-validation'

function templateNode(id: string, content: string, parentId?: string): ZotzFlowNode {
  return {
    id,
    name: id,
    kind: 'template',
    content,
    output: { mode: 'markdown' },
    position: { x: 0, y: 0 },
    parentId,
    retries: 0,
    onError: 'stop'
  }
}

function edge(from: string, to: string, port = 'main'): ZotzFlowEdge {
  return { id: `${from}-${to}`, from: { nodeId: from, port }, to: { nodeId: to } }
}

function problemsOf(nodes: ZotzFlowNode[], edges: ZotzFlowEdge[]): [string, string | undefined][] {
  return validateZotzFlow({ triggers: [], nodes, edges }).map((p) => [p.code, p.nodeId])
}

describe('validateZotzFlow', () => {
  it('flags every node on a cycle', () => {
    const nodes = [templateNode('a', ''), templateNode('b', ''), templateNode('c', '')]
    expect(problemsOf(nodes, [edge('a', 'b'), edge('b', 'c'), edge('c', 'b')])).toEqual([
      ['cycle', 'b'],
      ['cycle', 'c']
    ])
  })

  it('rejects a template that reads a node running later or in a parallel branch', () => {
    const nodes = [
      templateNode('first', ''),
      templateNode('left', '{{right.output}}'),
      templateNode('right', ''),
      templateNode('last', '{{first.output}} {{left.output}}')
    ]
    const edges = [edge('first', 'left'), edge('first', 'right'), edge('left', 'last')]
    expect(problemsOf(nodes, edges)).toEqual([['template_not_before', 'left']])
  })

  it('allows {{item}} only inside a for_each body', () => {
    const loop: ZotzFlowNode = {
      id: 'loop',
      name: 'loop',
      kind: 'for_each',
      items: '{{source.json.list}}',
      order: 'parallel',
      maxItems: 100,
      position: { x: 0, y: 0 },
      retries: 0,
      onError: 'stop'
    }
    const nodes = [
      templateNode('source', ''),
      loop,
      templateNode('inside', '{{item.title}} {{source.output}}', 'loop'),
      templateNode('outside', '{{item}}')
    ]
    expect(
      problemsOf(nodes, [edge('source', 'loop'), edge('loop', 'outside', 'complete')])
    ).toEqual([['template_item_outside_loop', 'outside']])
  })
})
