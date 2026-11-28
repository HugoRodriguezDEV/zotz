import type { ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowRun } from '../../../shared/zotz/flows/zotz-flow-run-contract'

/**
 * Where something came from when a flow caused it: an agent a flow step launched, or anything
 * in the workspace a step created for its run. `flowIds` also lists the flows that called this
 * one as a subflow, so none of them reacts to it.
 */
export type ZotzFlowOriginMark = {
  flowId: string
  runId: string
  nodeId: string
  flowIds: string[]
}

/** Why a run starts; passed to `startZotzFlowRun` by every trigger source. */
export type ZotzFlowRunOrigin =
  | { source: 'manual' }
  | { source: 'schedule' }
  /** `causedBy`: the mark `findZotzFlowOriginMark` found on what fired the event, or null. */
  | { source: 'event'; causedBy: ZotzFlowOriginMark | null }
  | { source: 'chat' }
  | { source: 'flow'; parent: { flowId: string; runId: string; nodeId: string } }

/** What an event names: any of these identifies the agent or workspace it is about. */
export type ZotzFlowOriginTarget = {
  chatSessionId?: string | null
  terminalPaneKey?: string | null
  terminalPtyId?: string | null
  workspaceId?: string | null
}

function callerFlowIds(run: ZotzFlowRun, runs: ReadonlyMap<string, ZotzFlowRun>): string[] {
  const ids = [run.flowId]
  for (let parent = run.parent; parent && ids.length < 32;) {
    ids.push(parent.flowId)
    parent = runs.get(parent.runId)?.parent
  }
  return ids
}

// The chat's own reply to a flow prompt can end a moment after the step records it.
const BORROWED_CHAT_GRACE_MS = 60_000

/** The flow step behind an agent or workspace, if a flow launched or created it. */
export function findZotzFlowOriginMark(
  getFlow: (id: string) => Pick<ZotzFlow, 'nodes'> | null,
  runs: readonly ZotzFlowRun[],
  target: ZotzFlowOriginTarget,
  now: number = Date.now()
): ZotzFlowOriginMark | null {
  const byId = new Map(runs.map((run) => [run.id, run]))
  const newestFirst = [...runs].sort((a, b) => b.createdAt - a.createdAt)
  for (const run of newestFirst) {
    const flow = getFlow(run.flowId)
    for (const nodeRun of run.nodes) {
      const link = nodeRun.agentSession
      if (!link) {
        continue
      }
      const node = flow?.nodes.find((entry) => entry.id === nodeRun.nodeId)
      // The chat that fired the flow stays the user's: only the turn the step sent is the flow's.
      const borrowed = node?.kind === 'agent' && node.runInChatSession
      if (
        borrowed &&
        nodeRun.finishedAt !== null &&
        now - nodeRun.finishedAt > BORROWED_CHAT_GRACE_MS
      ) {
        continue
      }
      const sameAgent =
        (target.chatSessionId && link.chatSessionId === target.chatSessionId) ||
        (target.terminalPaneKey && link.terminalPaneKey === target.terminalPaneKey) ||
        (target.terminalPtyId && link.terminalPtyId === target.terminalPtyId)
      // Only a workspace the step created belongs to the flow; an existing one is the user's too.
      const ownWorkspace =
        target.workspaceId &&
        link.workspaceId === target.workspaceId &&
        node?.kind === 'agent' &&
        node.workspaceSource === 'new_per_run'
      if (sameAgent || ownWorkspace) {
        return {
          flowId: run.flowId,
          runId: run.id,
          nodeId: nodeRun.nodeId,
          flowIds: callerFlowIds(run, byId)
        }
      }
    }
  }
  return null
}

/** Loop guard (spec §4.2): an event trigger never reacts to what the same flow caused. */
export function isZotzFlowOwnEcho(flowId: string, origin: ZotzFlowRunOrigin): boolean {
  return origin.source === 'event' && origin.causedBy?.flowIds.includes(flowId) === true
}
