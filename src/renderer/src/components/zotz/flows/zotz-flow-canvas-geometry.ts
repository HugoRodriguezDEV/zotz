import type { ZotzFlowNode } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'

type Point = { x: number; y: number }
type Size = { width: number; height: number }

export const ZOTZ_FLOW_NODE_SIZE: Size = { width: 280, height: 112 }
export const ZOTZ_FLOW_LOOP_PADDING = 24
export const ZOTZ_FLOW_LOOP_HEADER = 100
/** Room under the body for the loop's output ports. */
const LOOP_FOOTER = 64
const LOOP_MIN: Size = { width: 360, height: 260 }

export function indexZotzFlowNodes(nodes: readonly ZotzFlowNode[]): Map<string, ZotzFlowNode> {
  return new Map(nodes.map((node) => [node.id, node]))
}

/** Enclosing loops, innermost first; stops on a broken or cyclic chain. */
export function zotzFlowParentChain(
  node: ZotzFlowNode,
  byId: ReadonlyMap<string, ZotzFlowNode>
): ZotzFlowNode[] {
  const chain: ZotzFlowNode[] = []
  let parent = node.parentId ? byId.get(node.parentId) : undefined
  while (parent && parent.id !== node.id && !chain.includes(parent)) {
    chain.push(parent)
    parent = parent.parentId ? byId.get(parent.parentId) : undefined
  }
  return chain
}

export function zotzFlowAbsolutePosition(
  node: ZotzFlowNode,
  byId: ReadonlyMap<string, ZotzFlowNode>
): Point {
  return zotzFlowParentChain(node, byId).reduce(
    (point, parent) => ({ x: point.x + parent.position.x, y: point.y + parent.position.y }),
    { ...node.position }
  )
}

/** A loop grows to hold its body; positions inside it are relative to its corner. */
export function zotzFlowNodeSize(
  node: ZotzFlowNode,
  nodes: readonly ZotzFlowNode[],
  visiting: ReadonlySet<string> = new Set()
): Size {
  if (node.kind !== 'for_each' || visiting.has(node.id)) {
    return node.kind === 'for_each' ? LOOP_MIN : ZOTZ_FLOW_NODE_SIZE
  }
  const inside = new Set(visiting).add(node.id)
  let { width, height } = LOOP_MIN
  for (const child of nodes) {
    if (child.parentId !== node.id) {
      continue
    }
    const size = zotzFlowNodeSize(child, nodes, inside)
    width = Math.max(width, child.position.x + size.width + ZOTZ_FLOW_LOOP_PADDING)
    height = Math.max(height, child.position.y + size.height + LOOP_FOOTER)
  }
  return { width, height }
}

export function isZotzFlowDescendant(
  candidate: ZotzFlowNode,
  ancestorId: string,
  byId: ReadonlyMap<string, ZotzFlowNode>
): boolean {
  return zotzFlowParentChain(candidate, byId).some((parent) => parent.id === ancestorId)
}

/** The innermost loop whose box holds the node's center, skipping the node and its own body. */
export function findZotzFlowDropLoop(
  node: ZotzFlowNode,
  absolute: Point,
  nodes: readonly ZotzFlowNode[]
): ZotzFlowNode | null {
  const byId = indexZotzFlowNodes(nodes)
  const size = zotzFlowNodeSize(node, nodes)
  const center = { x: absolute.x + size.width / 2, y: absolute.y + size.height / 2 }
  let best: { loop: ZotzFlowNode; depth: number } | null = null
  for (const loop of nodes) {
    if (
      loop.kind !== 'for_each' ||
      loop.id === node.id ||
      isZotzFlowDescendant(loop, node.id, byId)
    ) {
      continue
    }
    const corner = zotzFlowAbsolutePosition(loop, byId)
    const box = zotzFlowNodeSize(loop, nodes)
    const inside =
      center.x >= corner.x &&
      center.x <= corner.x + box.width &&
      center.y >= corner.y &&
      center.y <= corner.y + box.height
    const depth = zotzFlowParentChain(loop, byId).length
    if (inside && (!best || depth > best.depth)) {
      best = { loop, depth }
    }
  }
  return best?.loop ?? null
}
