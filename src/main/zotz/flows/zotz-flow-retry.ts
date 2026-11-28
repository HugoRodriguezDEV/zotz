import type { ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowNodeRun,
  ZotzFlowRun
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import { buildZotzFlowAdjacency } from '../../../shared/zotz/flows/zotz-flow-graph'

function outermostStep(flow: ZotzFlow, nodeId: string): string {
  const byId = new Map(flow.nodes.map((node) => [node.id, node]))
  let current = byId.get(nodeId)
  while (current?.parentId !== undefined) {
    const parent = byId.get(current.parentId)
    if (!parent) {
      break
    }
    current = parent
  }
  return current?.id ?? nodeId
}

/** The step a retry starts from: the one asked for, or the first that failed. */
export function zotzFlowRetryStart(
  run: ZotzFlowRun,
  fromNodeId: string | undefined
): string | null {
  if (fromNodeId !== undefined) {
    return fromNodeId
  }
  const failed = run.nodes
    .filter((nodeRun) => nodeRun.status === 'failed')
    .sort(
      (a, b) => a.iteration.length - b.iteration.length || (a.startedAt ?? 0) - (b.startedAt ?? 0)
    )
  return failed[0]?.nodeId ?? null
}

function isSettled(nodeRun: ZotzFlowNodeRun): boolean {
  return (
    nodeRun.status === 'done' ||
    nodeRun.status === 'skipped' ||
    (nodeRun.status === 'failed' && nodeRun.port !== null)
  )
}

/**
 * Step results a retry keeps (spec §5: "with the same inputs"): everything before the restart
 * point, plus the iterations of a restarted loop that already finished.
 */
export function zotzFlowRetryKeptNodes(
  flow: ZotzFlow,
  run: ZotzFlowRun,
  fromNodeId: string
): ZotzFlowNodeRun[] {
  const start = outermostStep(flow, fromNodeId)
  const graph = buildZotzFlowAdjacency(flow.edges)
  const reset = new Set<string>([start])
  for (const pending = [start]; pending.length > 0;) {
    for (const next of graph.next.get(pending.pop()!) ?? []) {
      if (!reset.has(next)) {
        reset.add(next)
        pending.push(next)
      }
    }
  }
  const doneIterations = new Map<string, Set<number>>()
  for (const nodeRun of run.nodes) {
    if (nodeRun.loop && nodeRun.iteration.length === 0) {
      doneIterations.set(
        nodeRun.nodeId,
        new Set(nodeRun.loop.iterations.filter((it) => it.status === 'done').map((it) => it.index))
      )
    }
  }
  return run.nodes
    .filter((nodeRun) => {
      const top = outermostStep(flow, nodeRun.nodeId)
      if (!reset.has(top)) {
        return isSettled(nodeRun)
      }
      // Inside a restarted loop, a finished iteration keeps all its steps.
      return (
        top !== nodeRun.nodeId &&
        isSettled(nodeRun) &&
        doneIterations.get(top)?.has(nodeRun.iteration[0] ?? -1) === true
      )
    })
    .map((nodeRun) => structuredClone(nodeRun))
}
