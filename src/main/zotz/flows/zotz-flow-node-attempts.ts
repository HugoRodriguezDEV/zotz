import {
  getZotzFlowNodePorts,
  ZOTZ_FLOW_ERROR_PORT,
  ZOTZ_FLOW_SWITCH_DEFAULT_PORT,
  type ZotzFlowNode
} from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type {
  ZotzFlowNodeAttempt,
  ZotzFlowNodeRun
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowEngine } from './zotz-flow-engine'
import { ZotzFlowStepError, type ZotzFlowStepContext } from './zotz-flow-executor-types'
import { runZotzFlowStep } from './zotz-flow-steps'
import {
  resolveZotzFlowTemplate,
  resolveZotzFlowTemplateValue,
  type ZotzFlowLoopItem
} from './zotz-flow-template-resolution'

export type ZotzFlowNodeOutcome = {
  /** Port the step left through; null when nothing downstream should run. */
  port: string | null
  /** Set when the step failed with `onError: 'stop'`. */
  stop: string | null
}

// Steps that can pick up again after a restart; the rest fail as interrupted (spec §5).
const RESUMABLE_KINDS = new Set<ZotzFlowNode['kind']>([
  'agent',
  'approval',
  'wait',
  'for_each',
  'subflow'
])

/**
 * `continue` keeps the flow going through `main`, or through the node's "negative" port when it
 * has no `main` (false, default, rejected, with failures).
 */
export function zotzFlowContinuePort(node: ZotzFlowNode): string | null {
  const ports = getZotzFlowNodePorts(node).filter((port) => port !== ZOTZ_FLOW_ERROR_PORT)
  if (ports.includes('main')) {
    return 'main'
  }
  switch (node.kind) {
    case 'condition':
      return 'false'
    case 'approval':
      return 'rejected'
    case 'for_each':
      return 'with_failures'
    case 'switch':
      return ZOTZ_FLOW_SWITCH_DEFAULT_PORT
    case 'agent':
    case 'command':
    case 'http':
    case 'template':
    case 'subflow':
    case 'parallel':
    case 'join':
    case 'wait':
    case 'notify':
    case 'chat_reply':
      return null
  }
}

function describe(error: unknown): { message: string; code: string } {
  if (error instanceof ZotzFlowStepError) {
    return { message: error.message, code: error.code }
  }
  return { message: error instanceof Error ? error.message : String(error), code: 'step_failed' }
}

function beginAttempt(engine: ZotzFlowEngine, nodeRun: ZotzFlowNodeRun): ZotzFlowNodeAttempt {
  const attempt: ZotzFlowNodeAttempt = {
    attempt: nodeRun.attempts.length + 1,
    startedAt: engine.deps.now(),
    finishedAt: null,
    error: null
  }
  nodeRun.attempts.push(attempt)
  nodeRun.status = 'running'
  nodeRun.port = null
  nodeRun.error = null
  nodeRun.errorCode = undefined
  nodeRun.finishedAt = null
  return attempt
}

/** One step, with retries, timeout and `onError` (spec §4.3). Never rejects. */
export async function executeZotzFlowNode(
  engine: ZotzFlowEngine,
  node: ZotzFlowNode,
  path: number[],
  item: ZotzFlowLoopItem | null,
  levelSignal: AbortSignal
): Promise<ZotzFlowNodeOutcome> {
  const { deps } = engine
  const nodeRun = engine.nodeRun(node, path)
  if (node.kind === 'chat_reply' && engine.run.trigger.kind !== 'chat_command') {
    // Another trigger fired the flow: there is no chat to reply in (spec §4.3).
    console.info(`[zotz-flows] skipped chat reply "${node.name}": no chat fired this run`)
    engine.markUnreached(node, path, 'skipped', {
      error: 'Skipped: only a chat command can reply in a chat.',
      errorCode: 'chat_reply_no_chat'
    })
    return { port: null, stop: null }
  }
  let resuming =
    engine.resuming &&
    nodeRun.attempts.length > 0 &&
    ['queued', 'running', 'waiting_approval'].includes(nodeRun.status)
  const maxAttempts = node.retries + 1
  for (;;) {
    const attempt = resuming ? nodeRun.attempts.at(-1)! : beginAttempt(engine, nodeRun)
    engine.changed()
    const controller = new AbortController()
    const abort = (): void => controller.abort(levelSignal.reason)
    levelSignal.addEventListener('abort', abort, { once: true })
    let timer: ReturnType<typeof setTimeout> | null = null
    let timedOut = false
    const markStarted = (): void => {
      nodeRun.startedAt ??= deps.now()
      if (nodeRun.status === 'queued') {
        nodeRun.status = 'running'
      }
      engine.changed()
      if (node.timeoutSeconds !== undefined && node.kind !== 'approval' && timer === null) {
        timer = setTimeout(() => {
          timedOut = true
          controller.abort(
            new ZotzFlowStepError(`Timed out after ${node.timeoutSeconds}s.`, 'timeout')
          )
        }, node.timeoutSeconds * 1000)
      }
    }
    const ctx: ZotzFlowStepContext = {
      deps,
      flow: engine.flow,
      run: engine.run,
      node,
      nodeRun,
      path,
      item,
      attempt,
      signal: controller.signal,
      resuming,
      resolve: (text) => resolveZotzFlowTemplate(text, engine.scope(path, item)),
      resolveValue: (text) => resolveZotzFlowTemplateValue(text, engine.scope(path, item)),
      markStarted,
      changed: () => engine.changed(),
      runLevel: (parentId, childPath, childItem) =>
        engine.runLevel(parentId, childPath, childItem, controller.signal),
      waitForApproval: () => engine.awaitApproval(node, nodeRun, controller.signal)
    }
    try {
      if (resuming && !RESUMABLE_KINDS.has(node.kind)) {
        throw new ZotzFlowStepError('Zotz restarted during this step.', 'restarted')
      }
      if (node.kind !== 'agent') {
        markStarted()
      }
      const result = await runZotzFlowStep(ctx)
      const now = deps.now()
      nodeRun.status = 'done'
      nodeRun.output = result.output ?? nodeRun.output ?? null
      nodeRun.port = result.port ?? 'main'
      nodeRun.finishedAt = now
      attempt.finishedAt = now
      engine.changed()
      return { port: nodeRun.port, stop: null }
    } catch (thrown) {
      const now = deps.now()
      attempt.finishedAt = now
      if (levelSignal.aborted) {
        attempt.error = 'Cancelled.'
        nodeRun.status = 'cancelled'
        nodeRun.finishedAt = now
        engine.changed()
        return { port: null, stop: null }
      }
      const error = timedOut
        ? new ZotzFlowStepError(`Timed out after ${node.timeoutSeconds}s.`, 'timeout')
        : thrown
      const { message, code } = describe(error)
      attempt.error = message
      if (error instanceof ZotzFlowStepError && error.output) {
        nodeRun.output = error.output
      }
      // A restart is not something a retry fixes; the run can be retried from this step.
      if (code !== 'restarted' && nodeRun.attempts.length < maxAttempts) {
        resuming = false
        continue
      }
      nodeRun.status = 'failed'
      nodeRun.error = message
      nodeRun.errorCode = code
      nodeRun.finishedAt = now
      const onError = code === 'restarted' ? 'stop' : node.onError
      nodeRun.port =
        onError === 'error_port'
          ? ZOTZ_FLOW_ERROR_PORT
          : onError === 'continue'
            ? zotzFlowContinuePort(node)
            : null
      engine.changed()
      return {
        port: nodeRun.port,
        stop: onError === 'stop' ? `${node.name}: ${message}` : null
      }
    } finally {
      if (timer !== null) {
        clearTimeout(timer)
      }
      levelSignal.removeEventListener('abort', abort)
    }
  }
}
