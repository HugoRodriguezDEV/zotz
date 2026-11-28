import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowNode } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import {
  zotzFlowNodeSize,
  ZOTZ_FLOW_LOOP_HEADER,
  ZOTZ_FLOW_LOOP_PADDING
} from './zotz-flow-canvas-geometry'

const GAP_X = 60
const GAP_Y = 40

/**
 * Left-to-right layers by longest path from the roots, one level at a time: loop bodies first,
 * so each loop knows its size before its own level is placed.
 */
export function autoLayoutZotzFlow<T extends ZotzFlowDraft>(draft: T): T {
  let nodes = draft.nodes
  const levels = levelOrder(nodes)
  for (const parentId of levels) {
    const members = nodes.filter((node) => node.parentId === parentId)
    const origin = parentId
      ? { x: ZOTZ_FLOW_LOOP_PADDING, y: ZOTZ_FLOW_LOOP_HEADER }
      : { x: 0, y: 0 }
    const positions = layoutLevel(members, nodes, draft.edges, origin)
    nodes = nodes.map((node) => {
      const position = positions.get(node.id)
      return position ? { ...node, position } : node
    })
  }
  return { ...draft, nodes }
}

/** Deepest loops first, the top level (undefined) last. */
function levelOrder(nodes: readonly ZotzFlowNode[]): (string | undefined)[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const depth = (node: ZotzFlowNode): number => {
    let count = 0
    let parent = node.parentId ? byId.get(node.parentId) : undefined
    while (parent && count < nodes.length) {
      count += 1
      parent = parent.parentId ? byId.get(parent.parentId) : undefined
    }
    return count
  }
  const loops = nodes.filter((node) => node.kind === 'for_each')
  loops.sort((a, b) => depth(b) - depth(a))
  return [...loops.map((loop) => loop.id), undefined]
}

function layoutLevel(
  members: readonly ZotzFlowNode[],
  all: readonly ZotzFlowNode[],
  edges: ZotzFlowDraft['edges'],
  origin: { x: number; y: number }
): Map<string, { x: number; y: number }> {
  const ids = new Set(members.map((node) => node.id))
  const inner = edges.filter((edge) => ids.has(edge.from.nodeId) && ids.has(edge.to.nodeId))
  const layer = new Map<string, number>(members.map((node) => [node.id, 0]))
  // Bellman-style relaxation; capped at the member count so a cycle cannot loop forever.
  for (let pass = 0; pass < members.length; pass += 1) {
    let changed = false
    for (const edge of inner) {
      const next = (layer.get(edge.from.nodeId) ?? 0) + 1
      if (next > (layer.get(edge.to.nodeId) ?? 0) && next < members.length) {
        layer.set(edge.to.nodeId, next)
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }
  const columns: ZotzFlowNode[][] = []
  for (const node of members) {
    const index = layer.get(node.id) ?? 0
    ;(columns[index] ??= []).push(node)
  }
  const positions = new Map<string, { x: number; y: number }>()
  let x = origin.x
  for (const column of columns) {
    if (!column) {
      continue
    }
    let y = origin.y
    let width = 0
    for (const node of column) {
      const size = zotzFlowNodeSize(node, all)
      positions.set(node.id, { x, y })
      y += size.height + GAP_Y
      width = Math.max(width, size.width)
    }
    x += width + GAP_X
  }
  return positions
}
