import type { ZotzFlowNode } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import type {
  ZotzFlowNodeRun,
  ZotzFlowRun
} from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import { indexZotzFlowNodes, zotzFlowParentChain } from './zotz-flow-canvas-geometry'

/** Chosen item per loop id; a loop not in the map shows its first item. */
export type ZotzFlowIterationChoice = Readonly<Record<string, number>>

/** Loop indexes from the outermost loop in, as node runs are keyed. */
export function zotzFlowIterationPath(
  node: ZotzFlowNode,
  nodes: readonly ZotzFlowNode[],
  choice: ZotzFlowIterationChoice
): number[] {
  return zotzFlowParentChain(node, indexZotzFlowNodes(nodes))
    .toReversed()
    .map((loop) => choice[loop.id] ?? 0)
}

function samePath(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function findZotzFlowNodeRun(
  run: ZotzFlowRun,
  node: ZotzFlowNode,
  nodes: readonly ZotzFlowNode[],
  choice: ZotzFlowIterationChoice
): ZotzFlowNodeRun | null {
  const path = zotzFlowIterationPath(node, nodes, choice)
  return (
    run.nodes.find((entry) => entry.nodeId === node.id && samePath(entry.iteration, path)) ?? null
  )
}

export type ZotzFlowLoopProgress = {
  finished: number
  failed: number
  total: number
  failedItems: Set<number>
}

export function zotzFlowLoopProgress(nodeRun: ZotzFlowNodeRun | null): ZotzFlowLoopProgress | null {
  if (!nodeRun?.loop) {
    return null
  }
  const failedItems = new Set<number>()
  let finished = 0
  for (const iteration of nodeRun.loop.iterations) {
    if (iteration.status === 'failed') {
      failedItems.add(iteration.index)
    }
    if (['done', 'failed', 'skipped', 'cancelled'].includes(iteration.status)) {
      finished += 1
    }
  }
  return { finished, failed: failedItems.size, total: nodeRun.loop.total, failedItems }
}
