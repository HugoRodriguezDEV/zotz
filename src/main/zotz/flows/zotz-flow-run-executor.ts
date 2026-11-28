import type { ZotzFlow, ZotzFlowEdge } from '../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowNode } from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type {
  ZotzFlowNodeRun,
  ZotzFlowNodeRunStatus,
  ZotzFlowRun
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import { isFinalZotzFlowRunStatus } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import { zotzFlowNodeRunKey, type ZotzFlowEngine } from './zotz-flow-engine'
import type { ZotzFlowExecutorDeps, ZotzFlowLevelResult } from './zotz-flow-executor-types'
import { runZotzFlowLevel } from './zotz-flow-level-runner'
import { executeZotzFlowNode } from './zotz-flow-node-attempts'
import type { ZotzFlowLoopItem, ZotzFlowTemplateScope } from './zotz-flow-template-resolution'

type ApprovalWaiter = (
  decision: 'approved' | 'rejected',
  by: string | null,
  note: string | null
) => void

/** Executes one run of a flow; the run object is mutated in place and saved on every change. */
export class ZotzFlowRunExecutor implements ZotzFlowEngine {
  readonly resuming: boolean
  private readonly controller = new AbortController()
  private readonly nodesById = new Map<string, ZotzFlowNode>()
  private readonly nodesByName = new Map<string, ZotzFlowNode>()
  private readonly incomingEdges = new Map<string, ZotzFlowEdge[]>()
  private readonly withOutgoing = new Set<string>()
  private readonly nodeRuns = new Map<string, ZotzFlowNodeRun>()
  private readonly approvals = new Map<string, ApprovalWaiter>()

  constructor(
    readonly flow: ZotzFlow,
    readonly run: ZotzFlowRun,
    readonly deps: ZotzFlowExecutorDeps,
    options: { resuming: boolean }
  ) {
    this.resuming = options.resuming
    for (const node of flow.nodes) {
      this.nodesById.set(node.id, node)
      this.nodesByName.set(node.name, node)
    }
    for (const edge of flow.edges) {
      this.withOutgoing.add(edge.from.nodeId)
      this.incomingEdges.set(edge.to.nodeId, [
        ...(this.incomingEdges.get(edge.to.nodeId) ?? []),
        edge
      ])
    }
    for (const nodeRun of run.nodes) {
      this.nodeRuns.set(zotzFlowNodeRunKey(nodeRun.nodeId, nodeRun.iteration), nodeRun)
    }
  }

  async execute(): Promise<ZotzFlowRun> {
    const { run, deps } = this
    run.status = 'running'
    run.startedAt ??= deps.now()
    this.changed()
    let result: ZotzFlowLevelResult
    try {
      result = await this.executeGraph()
    } catch (error) {
      console.error('[zotz-flows] the run stopped unexpectedly:', error)
      result = {
        failed: true,
        error: error instanceof Error ? error.message : String(error),
        exit: null
      }
    }
    run.finishedAt = deps.now()
    if (this.controller.signal.aborted) {
      run.status = 'cancelled'
      run.error ??= 'Cancelled.'
    } else if (result.failed) {
      run.status = 'failed'
      run.error = result.error
    } else {
      run.status = 'done'
      run.error = null
    }
    this.changed()
    return run
  }

  private async executeGraph(): Promise<ZotzFlowLevelResult> {
    const testNode = this.run.testNodeId ? this.nodesById.get(this.run.testNodeId) : undefined
    if (this.run.testNodeId === undefined) {
      return runZotzFlowLevel(this, undefined, [], null, this.controller.signal)
    }
    if (!testNode || testNode.parentId !== undefined) {
      return { failed: true, error: 'Only a step outside loops can be tested alone.', exit: null }
    }
    const outcome = await executeZotzFlowNode(this, testNode, [], null, this.controller.signal)
    return { failed: outcome.stop !== null, error: outcome.stop, exit: null }
  }

  cancel(): void {
    this.controller.abort(new Error('Cancelled.'))
  }

  /** Settles a waiting approval; false when no step is waiting under that key. */
  approve(
    nodeId: string,
    iteration: readonly number[],
    decision: 'approved' | 'rejected',
    by: string | null,
    note: string | null
  ): boolean {
    const key = zotzFlowNodeRunKey(nodeId, iteration)
    const waiter = this.approvals.get(key)
    if (!waiter) {
      return false
    }
    waiter(decision, by, note)
    return true
  }

  nodesIn(parentId: string | undefined): ZotzFlowNode[] {
    return this.flow.nodes.filter((node) => node.parentId === parentId)
  }

  incoming(nodeId: string): ZotzFlowEdge[] {
    return this.incomingEdges.get(nodeId) ?? []
  }

  hasOutgoing(nodeId: string): boolean {
    return this.withOutgoing.has(nodeId)
  }

  existingNodeRun(nodeId: string, path: readonly number[]): ZotzFlowNodeRun | undefined {
    return this.nodeRuns.get(zotzFlowNodeRunKey(nodeId, path))
  }

  nodeRun(node: ZotzFlowNode, path: readonly number[]): ZotzFlowNodeRun {
    const key = zotzFlowNodeRunKey(node.id, path)
    let nodeRun = this.nodeRuns.get(key)
    if (!nodeRun) {
      nodeRun = {
        nodeId: node.id,
        iteration: [...path],
        status: 'pending',
        inputs: {},
        output: null,
        port: null,
        attempts: [],
        error: null,
        queuedAt: null,
        startedAt: null,
        finishedAt: null
      }
      this.nodeRuns.set(key, nodeRun)
      this.run.nodes.push(nodeRun)
    }
    return nodeRun
  }

  markUnreached(
    node: ZotzFlowNode,
    path: readonly number[],
    status: Extract<ZotzFlowNodeRunStatus, 'skipped' | 'cancelled'>,
    note?: { error: string; errorCode: string }
  ): void {
    const nodeRun = this.nodeRun(node, path)
    nodeRun.status = status
    nodeRun.port = null
    nodeRun.error = note?.error ?? null
    nodeRun.errorCode = note?.errorCode
    nodeRun.finishedAt = this.deps.now()
    this.changed()
  }

  scope(path: readonly number[], item: ZotzFlowLoopItem | null): ZotzFlowTemplateScope {
    return {
      trigger: this.run.trigger,
      chat: this.run.chat,
      item,
      node: (name) => {
        const target = this.nodesByName.get(name)
        if (!target) {
          return null
        }
        // A step outside the current loop is read at its own loop depth.
        const nodeRun = this.existingNodeRun(target.id, path.slice(0, this.loopDepth(target)))
        return nodeRun
          ? { status: nodeRun.status, output: nodeRun.output, exitCode: nodeRun.exitCode ?? null }
          : null
      }
    }
  }

  private loopDepth(node: ZotzFlowNode): number {
    let depth = 0
    for (let parent = node.parentId; parent !== undefined;) {
      depth++
      parent = this.nodesById.get(parent)?.parentId
    }
    return depth
  }

  awaitApproval(
    node: ZotzFlowNode,
    nodeRun: ZotzFlowNodeRun,
    signal: AbortSignal
  ): Promise<'approved' | 'rejected' | 'timeout'> {
    const key = zotzFlowNodeRunKey(nodeRun.nodeId, nodeRun.iteration)
    nodeRun.status = 'waiting_approval'
    // A restart keeps the original request, so the timeout still counts from it.
    nodeRun.approval ??= {
      requestedAt: this.deps.now(),
      decidedAt: null,
      decision: null,
      decidedBy: null,
      note: null
    }
    const approval = nodeRun.approval
    this.changed()
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null
      const settle = (
        decision: 'approved' | 'rejected' | 'timeout',
        by: string | null,
        note: string | null
      ): void => {
        cleanup()
        approval.decision = decision
        approval.decidedAt = this.deps.now()
        approval.decidedBy = by
        approval.note = note
        nodeRun.status = 'running'
        this.changed()
        resolve(decision)
      }
      const abort = (): void => {
        cleanup()
        reject(signal.reason)
      }
      const cleanup = (): void => {
        if (timer !== null) {
          clearTimeout(timer)
        }
        this.approvals.delete(key)
        signal.removeEventListener('abort', abort)
      }
      if (signal.aborted) {
        reject(signal.reason)
        return
      }
      signal.addEventListener('abort', abort, { once: true })
      this.approvals.set(key, settle)
      if (node.timeoutSeconds !== undefined) {
        const remaining = approval.requestedAt + node.timeoutSeconds * 1000 - this.deps.now()
        timer = setTimeout(() => settle('timeout', null, null), Math.max(0, remaining))
      }
    })
  }

  changed(): void {
    const { run } = this
    if (!isFinalZotzFlowRunStatus(run.status)) {
      const statuses = new Set(run.nodes.map((nodeRun) => nodeRun.status))
      run.status =
        statuses.has('waiting_approval') && !statuses.has('running') && !statuses.has('queued')
          ? 'waiting_approval'
          : 'running'
    }
    this.deps.save(run)
  }
}
