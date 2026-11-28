import type { ZotzFlow, ZotzFlowEdge } from '../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowNode } from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type {
  ZotzFlowNodeRun,
  ZotzFlowNodeRunStatus,
  ZotzFlowRun
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowExecutorDeps, ZotzFlowLevelResult } from './zotz-flow-executor-types'
import type { ZotzFlowLoopItem, ZotzFlowTemplateScope } from './zotz-flow-template-resolution'

/** What the level and step runners need from the run being executed. */
export type ZotzFlowEngine = {
  readonly flow: ZotzFlow
  readonly run: ZotzFlowRun
  readonly deps: ZotzFlowExecutorDeps
  /** True while re-entering the steps a restart interrupted. */
  readonly resuming: boolean
  nodesIn(parentId: string | undefined): ZotzFlowNode[]
  incoming(nodeId: string): ZotzFlowEdge[]
  hasOutgoing(nodeId: string): boolean
  existingNodeRun(nodeId: string, path: readonly number[]): ZotzFlowNodeRun | undefined
  nodeRun(node: ZotzFlowNode, path: readonly number[]): ZotzFlowNodeRun
  /** Records a step that never ran (no input arrived, or the level stopped first). */
  markUnreached(
    node: ZotzFlowNode,
    path: readonly number[],
    status: Extract<ZotzFlowNodeRunStatus, 'skipped' | 'cancelled'>,
    note?: { error: string; errorCode: string }
  ): void
  scope(path: readonly number[], item: ZotzFlowLoopItem | null): ZotzFlowTemplateScope
  awaitApproval(
    node: ZotzFlowNode,
    nodeRun: ZotzFlowNodeRun,
    signal: AbortSignal
  ): Promise<'approved' | 'rejected' | 'timeout'>
  changed(): void
  /** Runs a loop body; passed through here so steps and levels do not import each other. */
  runLevel(
    parentId: string,
    path: number[],
    item: ZotzFlowLoopItem,
    signal: AbortSignal
  ): Promise<ZotzFlowLevelResult>
}

export function zotzFlowNodeRunKey(nodeId: string, path: readonly number[]): string {
  return `${nodeId}|${path.join('.')}`
}
