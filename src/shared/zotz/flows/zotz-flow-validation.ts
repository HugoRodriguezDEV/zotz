import type { ZotzFlowDraft, ZotzFlowEdge } from './zotz-flow-contract'
import { ZOTZ_FLOW_RESERVED_NAMES } from './zotz-flow-fields'
import {
  buildZotzFlowAdjacency,
  createZotzFlowUpstreamIndex,
  type ZotzFlowAdjacency
} from './zotz-flow-graph'
import {
  getZotzFlowNodePorts,
  ZOTZ_FLOW_ERROR_PORT,
  ZOTZ_FLOW_SWITCH_DEFAULT_PORT,
  type ZotzFlowNode
} from './zotz-flow-node-contract'
import { zotzFlowError, zotzFlowWarning, type ZotzFlowProblem } from './zotz-flow-problems'
import {
  checkZotzFlowChatOnlyNodes,
  checkZotzFlowTemplates,
  type ZotzFlowTemplateScope
} from './zotz-flow-template-validation'

export type ZotzFlowGraph = Pick<ZotzFlowDraft, 'triggers' | 'nodes' | 'edges'>

/** Pure graph validation shared by the engine (on save) and the canvas (live). */
export function validateZotzFlow(flow: ZotzFlowGraph): ZotzFlowProblem[] {
  const problems: ZotzFlowProblem[] = []
  const nodesById = indexNodes(flow.nodes, problems)
  checkNames(flow.nodes, problems)
  const loopChains = checkParents(flow.nodes, nodesById, problems)
  const graph = buildZotzFlowAdjacency(checkEdges(flow.edges, nodesById, problems))
  const upstream = createZotzFlowUpstreamIndex(graph)

  for (const node of flow.nodes) {
    if (upstream(node.id).has(node.id)) {
      problems.push(zotzFlowError('cycle', 'This node is part of a cycle.', { nodeId: node.id }))
    }
  }
  checkSwitchCases(flow.nodes, problems)
  checkConnectivity(flow.nodes, graph, problems)
  checkLoopBodies(flow.nodes, graph, problems)

  checkZotzFlowTemplates(flow, buildTemplateScope(loopChains, upstream), problems)
  checkZotzFlowChatOnlyNodes(flow, problems)
  return problems
}

/** What a node's templates may read, by the same rules validation applies; the canvas picker offers it. */
export function createZotzFlowTemplateScope(flow: ZotzFlowGraph): ZotzFlowTemplateScope {
  const ignored: ZotzFlowProblem[] = []
  const nodesById = indexNodes(flow.nodes, ignored)
  const loopChains = checkParents(flow.nodes, nodesById, ignored)
  const graph = buildZotzFlowAdjacency(checkEdges(flow.edges, nodesById, ignored))
  return buildTemplateScope(loopChains, createZotzFlowUpstreamIndex(graph))
}

function buildTemplateScope(
  loopChains: Map<string, string[]>,
  upstream: (nodeId: string) => ReadonlySet<string>
): ZotzFlowTemplateScope {
  const loops = (nodeId: string): string[] => loopChains.get(nodeId) ?? []
  const beforeCache = new Map<string, Set<string>>()
  const before = (nodeId: string): ReadonlySet<string> => {
    let result = beforeCache.get(nodeId)
    if (!result) {
      // A loop body also runs after everything upstream of its enclosing loops.
      result = new Set([nodeId, ...loops(nodeId)].flatMap((id) => [...upstream(id)]))
      result.delete(nodeId)
      beforeCache.set(nodeId, result)
    }
    return result
  }
  return { before, loops }
}

function indexNodes(nodes: ZotzFlowNode[], problems: ZotzFlowProblem[]): Map<string, ZotzFlowNode> {
  const byId = new Map<string, ZotzFlowNode>()
  for (const node of nodes) {
    if (byId.has(node.id)) {
      problems.push(
        zotzFlowError('duplicate_node_id', `Node id "${node.id}" is used twice.`, {
          nodeId: node.id
        })
      )
      continue
    }
    byId.set(node.id, node)
  }
  return byId
}

function checkNames(nodes: ZotzFlowNode[], problems: ZotzFlowProblem[]): void {
  const reserved = new Set<string>(ZOTZ_FLOW_RESERVED_NAMES)
  const counts = new Map<string, number>()
  for (const node of nodes) {
    counts.set(node.name, (counts.get(node.name) ?? 0) + 1)
  }
  for (const node of nodes) {
    const at = { nodeId: node.id, params: { name: node.name } }
    if (reserved.has(node.name)) {
      problems.push(
        zotzFlowError('reserved_node_name', `"${node.name}" is reserved for templates.`, at)
      )
    }
    if ((counts.get(node.name) ?? 0) > 1) {
      problems.push(
        zotzFlowError('duplicate_node_name', `Another node is also named "${node.name}".`, at)
      )
    }
  }
}

/** Each node's enclosing loops, innermost first; a broken chain yields none. */
function checkParents(
  nodes: ZotzFlowNode[],
  nodesById: Map<string, ZotzFlowNode>,
  problems: ZotzFlowProblem[]
): Map<string, string[]> {
  const chains = new Map<string, string[]>()
  for (const node of nodes) {
    const chain: string[] = []
    let parentId = node.parentId
    let broken = false
    while (parentId !== undefined) {
      const parent = nodesById.get(parentId)
      if (!parent || parent.kind !== 'for_each') {
        if (parentId === node.parentId) {
          problems.push(
            zotzFlowError('parent_not_for_each', 'A node can only sit inside a "for each" loop.', {
              nodeId: node.id
            })
          )
        }
        broken = true
        break
      }
      if (parent.id === node.id || chain.includes(parent.id)) {
        problems.push(
          zotzFlowError('parent_cycle', 'Loops contain each other.', { nodeId: node.id })
        )
        broken = true
        break
      }
      chain.push(parent.id)
      parentId = parent.parentId
    }
    chains.set(node.id, broken ? [] : chain)
  }
  return chains
}

/** Returns the edges the rest of validation can trust. */
function checkEdges(
  edges: ZotzFlowEdge[],
  nodesById: Map<string, ZotzFlowNode>,
  problems: ZotzFlowProblem[]
): ZotzFlowEdge[] {
  const valid: ZotzFlowEdge[] = []
  const seen = new Set<string>()
  for (const edge of edges) {
    const from = nodesById.get(edge.from.nodeId)
    const to = nodesById.get(edge.to.nodeId)
    if (!from || !to) {
      problems.push(
        zotzFlowError('edge_unknown_node', 'Connection to a node that does not exist.', {
          edgeId: edge.id
        })
      )
      continue
    }
    if (!getZotzFlowNodePorts(from).includes(edge.from.port)) {
      problems.push(
        zotzFlowError('edge_unknown_port', `"${from.name}" has no "${edge.from.port}" output.`, {
          edgeId: edge.id,
          nodeId: from.id,
          params: { port: edge.from.port, name: from.name }
        })
      )
      continue
    }
    if (from.parentId !== to.parentId) {
      problems.push(
        zotzFlowError('edge_crosses_loop', 'Connections cannot cross a loop boundary.', {
          edgeId: edge.id,
          nodeId: to.id
        })
      )
      continue
    }
    const key = `${from.id}\0${edge.from.port}\0${to.id}`
    if (seen.has(key)) {
      problems.push(zotzFlowWarning('duplicate_edge', 'Duplicate connection.', { edgeId: edge.id }))
      continue
    }
    seen.add(key)
    valid.push(edge)
  }
  return valid
}

function checkSwitchCases(nodes: ZotzFlowNode[], problems: ZotzFlowProblem[]): void {
  for (const node of nodes) {
    if (node.kind !== 'switch') {
      continue
    }
    const seen = new Set<string>([ZOTZ_FLOW_SWITCH_DEFAULT_PORT, ZOTZ_FLOW_ERROR_PORT])
    for (const entry of node.cases) {
      if (seen.has(entry.port)) {
        problems.push(
          zotzFlowError(
            'duplicate_switch_case',
            `Output "${entry.port}" is repeated or reserved.`,
            {
              nodeId: node.id,
              params: { port: entry.port }
            }
          )
        )
      }
      seen.add(entry.port)
    }
  }
}

// Several roots are fine (all start together); a node with no connection at all is not.
function checkConnectivity(
  nodes: ZotzFlowNode[],
  graph: ZotzFlowAdjacency,
  problems: ZotzFlowProblem[]
): void {
  const levelSizes = new Map<string | undefined, number>()
  for (const node of nodes) {
    levelSizes.set(node.parentId, (levelSizes.get(node.parentId) ?? 0) + 1)
  }
  for (const node of nodes) {
    const alone = !graph.next.has(node.id) && !graph.prev.has(node.id)
    if (alone && (levelSizes.get(node.parentId) ?? 0) > 1) {
      problems.push(
        zotzFlowError('disconnected_node', 'This node is not connected.', { nodeId: node.id })
      )
    }
  }
}

function checkLoopBodies(
  nodes: ZotzFlowNode[],
  graph: ZotzFlowAdjacency,
  problems: ZotzFlowProblem[]
): void {
  for (const loop of nodes) {
    if (loop.kind !== 'for_each') {
      continue
    }
    const body = nodes.filter((node) => node.parentId === loop.id)
    if (body.length === 0) {
      problems.push(
        zotzFlowError('for_each_empty', 'The loop has no steps inside.', { nodeId: loop.id })
      )
      continue
    }
    // One exit node gives each iteration a single output; branches merge before it.
    const exits = body.filter((node) => !graph.next.has(node.id))
    if (exits.length > 1) {
      problems.push(
        zotzFlowError('for_each_multiple_exits', 'The loop body must end in a single step.', {
          nodeId: loop.id,
          params: { count: String(exits.length) }
        })
      )
    }
  }
}
