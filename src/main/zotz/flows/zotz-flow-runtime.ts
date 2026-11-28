import type { z } from 'zod'
import { InvalidArgumentError } from '../../runtime/rpc/core'
import {
  isFinalZotzFlowRunStatus,
  type ZotzFlowRun,
  type ZotzFlowRunTrigger
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowsRunParams } from '../../../shared/rpc-contract/zotz/zotz-flows-params'
import { ZotzFlowStepError, type ZotzFlowExecutorDeps } from './zotz-flow-executor-types'
import {
  findZotzFlowOriginMark,
  type ZotzFlowOriginMark,
  type ZotzFlowOriginTarget,
  type ZotzFlowRunOrigin
} from './zotz-flow-origin'
import { zotzFlowRetryKeptNodes, zotzFlowRetryStart } from './zotz-flow-retry'
import { buildZotzFlowInputValues, buildZotzFlowRequestTrigger } from './zotz-flow-run-request'
import type {
  ZotzFlowService,
  ZotzFlowStartOptions,
  ZotzFlowStartResult
} from './zotz-flow-service'
import { summarizeZotzFlowRunOutput } from './zotz-flow-step-output'
import type { ZotzFlowStore } from './zotz-flow-store'
import type { ZotzAutomationMigrationOutcome } from './zotz-flow-automation-migration'

// Deep enough for real reuse, shallow enough that a flow calling itself stops quickly.
const MAX_SUBFLOW_DEPTH = 8

export type ZotzFlowRuntime = {
  store: ZotzFlowStore
  service: ZotzFlowService
  migrateAutomation: (automationId: string) => ZotzAutomationMigrationOutcome
}

let current: ZotzFlowRuntime | null = null

export function registerZotzFlowRuntime(next: ZotzFlowRuntime): () => void {
  current = next
  return () => {
    if (current === next) {
      current = null
    }
  }
}

export function getZotzFlowRuntime(): ZotzFlowRuntime | null {
  return current
}

function requireRuntime(): ZotzFlowRuntime {
  if (!current) {
    throw new Error('Flows are not running on this machine yet.')
  }
  return current
}

/**
 * Starts a run of a flow stored on this machine. Event triggers (part 3) pass
 * `{ source: 'event', causedBy: findZotzFlowOrigin(...) }`; the chat (part 4) passes
 * `{ source: 'chat' }` with `options.chat`.
 */
export function startZotzFlowRun(
  flowId: string,
  trigger: ZotzFlowRunTrigger,
  origin: ZotzFlowRunOrigin,
  options?: ZotzFlowStartOptions
): ZotzFlowStartResult {
  return requireRuntime().service.startRun(flowId, trigger, origin, options)
}

/** The flow step behind an agent session, terminal or workspace, if a flow launched it. */
export function findZotzFlowOrigin(target: ZotzFlowOriginTarget): ZotzFlowOriginMark | null {
  const runtime = getZotzFlowRuntime()
  return runtime
    ? findZotzFlowOriginMark((id) => runtime.store.getFlow(id), runtime.store.listAllRuns(), target)
    : null
}

function refuse(result: ZotzFlowStartResult): ZotzFlowRun {
  if (!result.ok) {
    throw new InvalidArgumentError(result.message)
  }
  return result.run
}

/** `zotz.flows.run`: by hand from the app, the CLI or the phone; also "test a node". */
export function runZotzFlowFromRequest(params: z.infer<typeof ZotzFlowsRunParams>): ZotzFlowRun {
  const { store, service } = requireRuntime()
  const flow =
    params.id !== undefined ? store.getFlow(params.id) : store.getFlowBySlug(params.slug!)
  if (!flow) {
    throw new InvalidArgumentError(`No flow "${params.id ?? params.slug}" on this machine.`)
  }
  const now = Date.now()
  if (params.testNodeId !== undefined) {
    // The last run's results stand in for everything before the tested step.
    const previous = store.listRuns(flow.id, 1).runs[0]
    const built = buildZotzFlowRequestTrigger(flow, params, now)
    return refuse(
      service.startRun(flow.id, previous?.trigger ?? built.trigger, built.origin, {
        chat: previous?.chat ?? params.chat ?? null,
        testNodeId: params.testNodeId,
        nodes: structuredClone(
          (previous?.nodes ?? []).filter((nodeRun) => nodeRun.nodeId !== params.testNodeId)
        )
      })
    )
  }
  const { trigger, origin } = buildZotzFlowRequestTrigger(flow, params, now)
  return refuse(service.startRun(flow.id, trigger, origin, { chat: params.chat ?? null }))
}

/** `zotz.flows.retry`: a new run from the failed step, keeping what came before (spec §5). */
export function retryZotzFlowRun(runId: string, fromNodeId: string | undefined): ZotzFlowRun {
  const { store, service } = requireRuntime()
  const run = store.getRun(runId)
  const flow = run ? store.getFlow(run.flowId) : null
  if (!run || !flow) {
    throw new InvalidArgumentError('This run or its flow no longer exists.')
  }
  if (!isFinalZotzFlowRunStatus(run.status)) {
    throw new InvalidArgumentError('This run is still going.')
  }
  const start = zotzFlowRetryStart(run, fromNodeId)
  if (start === null || !flow.nodes.some((node) => node.id === start)) {
    throw new InvalidArgumentError('There is no failed step to retry from.')
  }
  const origin: ZotzFlowRunOrigin = run.parent
    ? { source: 'flow', parent: run.parent }
    : { source: 'manual' }
  return refuse(
    service.startRun(flow.id, run.trigger, origin, {
      chat: run.chat,
      nodes: zotzFlowRetryKeptNodes(flow, run, start),
      resumedFromNodeId: start
    })
  )
}

function subflowDepth(store: ZotzFlowStore, runId: string): number {
  let depth = 0
  for (let run = store.getRun(runId); run?.parent && depth <= MAX_SUBFLOW_DEPTH; depth++) {
    run = store.getRun(run.parent.runId)
  }
  return depth
}

/** Subflow step: the callee runs through `flow_call` and hands back its last steps' output. */
export const runZotzSubflow: ZotzFlowExecutorDeps['runSubflow'] = async (request) => {
  const { store, service } = requireRuntime()
  let childId = request.existingRunId
  if (childId === undefined || !store.getRun(childId)) {
    const callee = store.getFlow(request.flowId)
    if (!callee) {
      throw new ZotzFlowStepError(
        'The called flow does not exist on this machine.',
        'subflow_missing'
      )
    }
    if (subflowDepth(store, request.parent.runId) >= MAX_SUBFLOW_DEPTH) {
      throw new ZotzFlowStepError('Subflows call each other too deep.', 'subflow_too_deep')
    }
    const entry = callee.triggers.find((trigger) => trigger.kind === 'flow_call')
    const trigger: ZotzFlowRunTrigger = {
      triggerId: entry?.id ?? null,
      kind: 'flow_call',
      inputs: buildZotzFlowInputValues(
        entry?.kind === 'flow_call' ? entry.inputs : [],
        request.inputs
      ),
      callerFlowId: request.parent.flowId,
      callerRunId: request.parent.runId
    }
    const started = service.startRun(callee.id, trigger, { source: 'flow', parent: request.parent })
    if (!started.ok) {
      throw new ZotzFlowStepError(started.message, `subflow_${started.reason}`)
    }
    childId = started.run.id
    request.onStarted(childId)
  }
  const id = childId
  const cancelChild = (): void => void service.cancel(id)
  request.signal.addEventListener('abort', cancelChild, { once: true })
  try {
    const run = await service.awaitFinal(id, request.signal)
    const callee = store.getFlow(run.flowId)
    return { run, output: callee ? summarizeZotzFlowRunOutput(callee, run, Date.now()) : null }
  } finally {
    request.signal.removeEventListener('abort', cancelChild)
  }
}
