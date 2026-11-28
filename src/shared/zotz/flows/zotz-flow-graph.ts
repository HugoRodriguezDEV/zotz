import type { ZotzFlowEdge } from './zotz-flow-contract'

export type ZotzFlowAdjacency = {
  next: Map<string, string[]>
  prev: Map<string, string[]>
}

export function buildZotzFlowAdjacency(edges: ZotzFlowEdge[]): ZotzFlowAdjacency {
  const next = new Map<string, string[]>()
  const prev = new Map<string, string[]>()
  for (const edge of edges) {
    appendTo(next, edge.from.nodeId, edge.to.nodeId)
    appendTo(prev, edge.to.nodeId, edge.from.nodeId)
  }
  return { next, prev }
}

function appendTo(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key)
  if (list) {
    list.push(value)
  } else {
    map.set(key, [value])
  }
}

/**
 * Every node that reaches a node through edges. The node itself is included only when it sits
 * on a cycle, which is how cycles are detected.
 */
export function createZotzFlowUpstreamIndex(
  graph: ZotzFlowAdjacency
): (nodeId: string) => ReadonlySet<string> {
  const cache = new Map<string, Set<string>>()
  return (nodeId) => {
    const cached = cache.get(nodeId)
    if (cached) {
      return cached
    }
    const seen = new Set<string>()
    const pending = [...(graph.prev.get(nodeId) ?? [])]
    while (pending.length > 0) {
      const id = pending.pop()!
      if (!seen.has(id)) {
        seen.add(id)
        pending.push(...(graph.prev.get(id) ?? []))
      }
    }
    cache.set(nodeId, seen)
    return seen
  }
}
