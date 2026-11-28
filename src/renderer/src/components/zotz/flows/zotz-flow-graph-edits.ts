import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowNode,
  ZotzFlowNodeKind
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { getZotzFlowNodePorts } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import {
  findZotzFlowDropLoop,
  indexZotzFlowNodes,
  isZotzFlowDescendant,
  zotzFlowAbsolutePosition,
  zotzFlowNodeSize,
  ZOTZ_FLOW_LOOP_HEADER,
  ZOTZ_FLOW_LOOP_PADDING,
  ZOTZ_FLOW_NODE_SIZE
} from './zotz-flow-canvas-geometry'
import {
  createZotzFlowNode,
  uniqueZotzFlowNodeName,
  ZOTZ_FLOW_NODE_KINDS
} from './zotz-flow-node-catalog'

const STEP_GAP_X = 80

export function newZotzFlowId(): string {
  return createNonSecureContextUuid()
}

/**
 * Adds a step. With `after`, it lands to its right in the same loop and takes its first free
 * output; with a loop as `after`, it goes inside that loop instead.
 */
export function addZotzFlowNode(
  draft: ZotzFlowDraft,
  kind: ZotzFlowNodeKind,
  options: {
    id?: string
    after?: string | null
    position?: { x: number; y: number }
    parentId?: string
  }
): { draft: ZotzFlowDraft; nodeId: string } {
  const id = options.id ?? newZotzFlowId()
  const name = uniqueZotzFlowNodeName(ZOTZ_FLOW_NODE_KINDS[kind].baseName, draft.nodes)
  const anchor = options.after ? draft.nodes.find((node) => node.id === options.after) : undefined
  const intoLoop = anchor?.kind === 'for_each' && !options.position
  const parentId = intoLoop ? anchor.id : (options.parentId ?? anchor?.parentId)
  const position = options.position ?? placeNewNode(draft.nodes, anchor, intoLoop)
  const node = createZotzFlowNode(kind, { id, name, position, parentId })
  let next: ZotzFlowDraft = { ...draft, nodes: [...draft.nodes, node] }
  if (anchor && !intoLoop) {
    const used = new Set(
      draft.edges.filter((e) => e.from.nodeId === anchor.id).map((e) => e.from.port)
    )
    const port = getZotzFlowNodePorts(anchor).find((candidate) => !used.has(candidate))
    if (port) {
      next = connectZotzFlowNodes(next, anchor.id, port, id)
    }
  }
  return { draft: next, nodeId: id }
}

function placeNewNode(
  nodes: readonly ZotzFlowNode[],
  anchor: ZotzFlowNode | undefined,
  intoLoop: boolean
): { x: number; y: number } {
  if (anchor && intoLoop) {
    const body = nodes.filter((node) => node.parentId === anchor.id)
    const right = Math.max(
      ZOTZ_FLOW_LOOP_PADDING - STEP_GAP_X,
      ...body.map((node) => node.position.x + zotzFlowNodeSize(node, nodes).width)
    )
    return { x: right + STEP_GAP_X, y: ZOTZ_FLOW_LOOP_HEADER }
  }
  if (anchor) {
    const siblings = nodes.filter((node) => node.parentId === anchor.parentId)
    const x = anchor.position.x + zotzFlowNodeSize(anchor, nodes).width + STEP_GAP_X
    let y = anchor.position.y
    // Step down past anything already sitting in that column.
    while (
      siblings.some(
        (node) => Math.abs(node.position.x - x) < 40 && Math.abs(node.position.y - y) < 60
      )
    ) {
      y += ZOTZ_FLOW_NODE_SIZE.height + 32
    }
    return { x, y }
  }
  const top = nodes.filter((node) => !node.parentId)
  const right = Math.max(
    -STEP_GAP_X,
    ...top.map((node) => node.position.x + zotzFlowNodeSize(node, nodes).width)
  )
  return { x: right + STEP_GAP_X, y: top[0]?.position.y ?? 0 }
}

export function connectZotzFlowNodes(
  draft: ZotzFlowDraft,
  fromId: string,
  port: string,
  toId: string
): ZotzFlowDraft {
  const from = draft.nodes.find((node) => node.id === fromId)
  const to = draft.nodes.find((node) => node.id === toId)
  const duplicate = draft.edges.some(
    (edge) => edge.from.nodeId === fromId && edge.from.port === port && edge.to.nodeId === toId
  )
  // Connections never cross a loop border (contract rule), so refuse them here too.
  if (!from || !to || from.id === to.id || from.parentId !== to.parentId || duplicate) {
    return draft
  }
  const edge = { id: newZotzFlowId(), from: { nodeId: fromId, port }, to: { nodeId: toId } }
  return { ...draft, edges: [...draft.edges, edge] }
}

/** Removes nodes with their loop bodies and every connection touching them. */
export function removeZotzFlowElements(
  draft: ZotzFlowDraft,
  nodeIds: readonly string[],
  edgeIds: readonly string[]
): ZotzFlowDraft {
  const byId = indexZotzFlowNodes(draft.nodes)
  const gone = new Set(nodeIds)
  for (const node of draft.nodes) {
    if (nodeIds.some((id) => isZotzFlowDescendant(node, id, byId))) {
      gone.add(node.id)
    }
  }
  const edgesGone = new Set(edgeIds)
  return {
    ...draft,
    nodes: draft.nodes.filter((node) => !gone.has(node.id)),
    edges: draft.edges.filter(
      (edge) => !edgesGone.has(edge.id) && !gone.has(edge.from.nodeId) && !gone.has(edge.to.nodeId)
    )
  }
}

export function updateZotzFlowNode(
  draft: ZotzFlowDraft,
  nodeId: string,
  update: (node: ZotzFlowNode) => ZotzFlowNode
): ZotzFlowDraft {
  return { ...draft, nodes: draft.nodes.map((node) => (node.id === nodeId ? update(node) : node)) }
}

export function moveZotzFlowNodes(
  draft: ZotzFlowDraft,
  positions: ReadonlyMap<string, { x: number; y: number }>
): ZotzFlowDraft {
  return {
    ...draft,
    nodes: draft.nodes.map((node) => {
      const position = positions.get(node.id)
      return position ? { ...node, position } : node
    })
  }
}

/** Moves a step into a loop (or out to the top level) and drops connections that would cross. */
export function setZotzFlowNodeParent(
  draft: ZotzFlowDraft,
  nodeId: string,
  parentId: string | undefined,
  absolute?: { x: number; y: number }
): ZotzFlowDraft {
  const byId = indexZotzFlowNodes(draft.nodes)
  const node = byId.get(nodeId)
  const parent = parentId ? byId.get(parentId) : undefined
  if (
    !node ||
    node.parentId === parentId ||
    (parent && isZotzFlowDescendant(parent, nodeId, byId))
  ) {
    return draft
  }
  const at = absolute ?? zotzFlowAbsolutePosition(node, byId)
  let position = at
  if (parent) {
    const corner = zotzFlowAbsolutePosition(parent, byId)
    position = {
      x: Math.max(ZOTZ_FLOW_LOOP_PADDING, at.x - corner.x),
      y: Math.max(ZOTZ_FLOW_LOOP_HEADER, at.y - corner.y)
    }
    if (!absolute) {
      position = placeNewNode(draft.nodes, parent, true)
    }
  }
  const moved: ZotzFlowNode = { ...node, position }
  if (parentId) {
    moved.parentId = parentId
  } else {
    delete moved.parentId
  }
  return {
    ...draft,
    nodes: draft.nodes.map((candidate) => (candidate.id === nodeId ? moved : candidate)),
    edges: draft.edges.filter((edge) => edge.from.nodeId !== nodeId && edge.to.nodeId !== nodeId)
  }
}

/** After a drag ends: enter the loop under the node, or leave the one it was dragged out of. */
export function reparentZotzFlowNodeAfterDrag(draft: ZotzFlowDraft, nodeId: string): ZotzFlowDraft {
  const byId = indexZotzFlowNodes(draft.nodes)
  const node = byId.get(nodeId)
  if (!node) {
    return draft
  }
  const absolute = zotzFlowAbsolutePosition(node, byId)
  const loop = findZotzFlowDropLoop(node, absolute, draft.nodes)
  return loop?.id === node.parentId
    ? draft
    : setZotzFlowNodeParent(draft, nodeId, loop?.id, absolute)
}
