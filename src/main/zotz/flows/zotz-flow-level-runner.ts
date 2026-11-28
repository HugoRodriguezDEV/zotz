import type { ZotzFlowNode } from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type { ZotzFlowNodeRun } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowEngine } from './zotz-flow-engine'
import type { ZotzFlowLevelResult } from './zotz-flow-executor-types'
import { executeZotzFlowNode } from './zotz-flow-node-attempts'
import type { ZotzFlowLoopItem } from './zotz-flow-template-resolution'

type Finished = { port: string | null }

/** A step that already ended keeps its result when a run resumes or is retried. */
function isSettled(nodeRun: ZotzFlowNodeRun): boolean {
  return (
    nodeRun.status === 'done' ||
    nodeRun.status === 'skipped' ||
    (nodeRun.status === 'failed' && nodeRun.port !== null)
  )
}

/**
 * Whether a step can start. It runs once every input ended and at least one reached it, and is
 * skipped when none did; a `join` set to "first" runs on the first input (PR #72).
 */
function readiness(
  engine: ZotzFlowEngine,
  node: ZotzFlowNode,
  finished: ReadonlyMap<string, Finished>
): 'run' | 'skip' | 'wait' {
  const incoming = engine.incoming(node.id)
  if (incoming.length === 0) {
    return 'run'
  }
  let fired = 0
  let unresolved = 0
  for (const edge of incoming) {
    const from = finished.get(edge.from.nodeId)
    if (!from) {
      unresolved++
    } else if (from.port === edge.from.port) {
      fired++
    }
  }
  if (node.kind === 'join' && node.waitFor === 'first' && fired > 0) {
    return 'run'
  }
  if (unresolved > 0) {
    return 'wait'
  }
  return fired > 0 ? 'run' : 'skip'
}

/** Runs the steps of the top level or of one loop iteration, in graph order. */
export async function runZotzFlowLevel(
  engine: ZotzFlowEngine,
  parentId: string | undefined,
  path: number[],
  item: ZotzFlowLoopItem | null,
  parentSignal: AbortSignal
): Promise<ZotzFlowLevelResult> {
  const nodes = engine.nodesIn(parentId)
  // A step that stops the level aborts its siblings without cancelling the whole run.
  const level = new AbortController()
  const abortLevel = (): void => level.abort(parentSignal.reason)
  parentSignal.addEventListener('abort', abortLevel, { once: true })
  if (parentSignal.aborted) {
    abortLevel()
  }
  const finished = new Map<string, Finished>()
  for (const node of nodes) {
    const existing = engine.existingNodeRun(node.id, path)
    if (existing && isSettled(existing)) {
      finished.set(node.id, { port: existing.port })
    }
  }
  const running = new Map<string, Promise<void>>()
  let stop: string | null = null
  try {
    for (;;) {
      let progressed = true
      while (progressed && stop === null && !level.signal.aborted) {
        progressed = false
        for (const node of nodes) {
          if (finished.has(node.id) || running.has(node.id)) {
            continue
          }
          const decision = readiness(engine, node, finished)
          if (decision === 'skip') {
            engine.markUnreached(node, path, 'skipped')
            finished.set(node.id, { port: null })
            progressed = true
          } else if (decision === 'run') {
            const step = executeZotzFlowNode(engine, node, path, item, level.signal).then(
              (outcome) => {
                running.delete(node.id)
                finished.set(node.id, { port: outcome.port })
                if (outcome.stop !== null && stop === null) {
                  stop = outcome.stop
                  level.abort(new Error(outcome.stop))
                }
              }
            )
            running.set(node.id, step)
          }
        }
      }
      if (running.size === 0) {
        break
      }
      await Promise.race(running.values())
    }
  } finally {
    parentSignal.removeEventListener('abort', abortLevel)
  }
  for (const node of nodes) {
    if (!finished.has(node.id)) {
      engine.markUnreached(node, path, parentSignal.aborted ? 'cancelled' : 'skipped')
    }
  }
  const exits = nodes.filter((node) => !engine.hasOutgoing(node.id))
  return {
    failed: stop !== null,
    error: stop,
    exit: exits.length === 1 ? (engine.existingNodeRun(exits[0].id, path) ?? null) : null
  }
}
