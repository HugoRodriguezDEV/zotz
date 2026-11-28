import { describe, expect, it } from 'vitest'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import { createZotzFlowNode } from './zotz-flow-node-catalog'
import {
  addZotzFlowNode,
  connectZotzFlowNodes,
  removeZotzFlowElements,
  reparentZotzFlowNodeAfterDrag
} from './zotz-flow-graph-edits'

function flow(): ZotzFlowDraft {
  return {
    id: 'f',
    name: 'f',
    slug: 'f',
    description: '',
    hostId: 'local',
    enabled: true,
    triggers: [],
    nodes: [
      createZotzFlowNode('condition', { id: 'check', name: 'check', position: { x: 0, y: 0 } }),
      createZotzFlowNode('for_each', { id: 'loop', name: 'loop', position: { x: 400, y: 0 } }),
      createZotzFlowNode('agent', {
        id: 'body',
        name: 'body',
        position: { x: 24, y: 84 },
        parentId: 'loop'
      }),
      createZotzFlowNode('notify', { id: 'tell', name: 'tell', position: { x: 0, y: 400 } })
    ],
    edges: [
      { id: 'e1', from: { nodeId: 'check', port: 'true' }, to: { nodeId: 'loop' } },
      { id: 'e2', from: { nodeId: 'check', port: 'false' }, to: { nodeId: 'tell' } }
    ],
    concurrency: { max: 1, whenBusy: 'queue' },
    maxRunsPerHour: 20
  }
}

describe('zotz flow graph edits', () => {
  it('refuses a connection that crosses a loop border', () => {
    const before = flow()
    expect(connectZotzFlowNodes(before, 'body', 'main', 'tell').edges).toHaveLength(2)
  })

  it('moves a step dropped over a loop into its body and drops its connections', () => {
    const draft = flow()
    const dropped = {
      ...draft,
      nodes: draft.nodes.map((node) =>
        node.id === 'tell' ? { ...node, position: { x: 420, y: 150 } } : node
      )
    }
    const next = reparentZotzFlowNodeAfterDrag(dropped, 'tell')
    const tell = next.nodes.find((node) => node.id === 'tell')
    expect(tell?.parentId).toBe('loop')
    expect(tell?.position).toEqual({ x: 24, y: 150 })
    expect(next.edges.map((edge) => edge.id)).toEqual(['e1'])
  })

  it('removes a loop together with its body and connections', () => {
    const next = removeZotzFlowElements(flow(), ['loop'], [])
    expect(next.nodes.map((node) => node.id)).toEqual(['check', 'tell'])
    expect(next.edges.map((edge) => edge.id)).toEqual(['e2'])
  })

  it('connects a new step through the first output still free', () => {
    const draft = removeZotzFlowElements(flow(), [], ['e2'])
    const { draft: next, nodeId } = addZotzFlowNode(draft, 'template', { id: 'n', after: 'check' })
    expect(next.edges.find((edge) => edge.to.nodeId === nodeId)?.from).toEqual({
      nodeId: 'check',
      port: 'false'
    })
  })
})
