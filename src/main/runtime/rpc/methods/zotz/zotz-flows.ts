import { defineMethod, defineStreamingMethod, InvalidArgumentError } from '../../core'
import {
  ZotzFlowsApproveParams,
  ZotzFlowsCancelParams,
  ZotzFlowsDeleteParams,
  ZotzFlowsGetParams,
  ZotzFlowsListParams,
  ZotzFlowsRetryParams,
  ZotzFlowsRunGetParams,
  ZotzFlowsRunParams,
  ZotzFlowsRunsParams,
  ZotzFlowsSaveParams,
  ZotzFlowsSubscribeParams,
  type ZotzFlowsApproveResult,
  type ZotzFlowsCancelResult,
  type ZotzFlowsDeleteResult,
  type ZotzFlowsGetResult,
  type ZotzFlowsListResult,
  type ZotzFlowsRetryResult,
  type ZotzFlowsRunGetResult,
  type ZotzFlowsRunResult,
  type ZotzFlowsRunsResult,
  type ZotzFlowsSaveResult,
  type ZotzFlowsStreamEvent
} from '../../../../../shared/rpc-contract/zotz/zotz-flows-params'
import { isFinalZotzFlowRunStatus } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import {
  getZotzFlowRuntime,
  retryZotzFlowRun,
  runZotzFlowFromRequest,
  type ZotzFlowRuntime
} from '../../../../zotz/flows/zotz-flow-runtime'

let subscriptionSeq = 0

function flows(): ZotzFlowRuntime {
  const runtime = getZotzFlowRuntime()
  if (!runtime) {
    throw new Error('Flows are still starting on this machine. Try again in a moment.')
  }
  return runtime
}

export const ZOTZ_FLOWS_METHODS = [
  defineMethod({
    name: 'zotz.flows.list',
    permission: 'workspace',
    params: ZotzFlowsListParams,
    handler: async (): Promise<ZotzFlowsListResult> => ({ flows: flows().store.listFlows() })
  }),
  defineMethod({
    name: 'zotz.flows.get',
    permission: 'workspace',
    params: ZotzFlowsGetParams,
    handler: async ({ id }): Promise<ZotzFlowsGetResult> => ({ flow: flows().store.getFlow(id) })
  }),
  defineMethod({
    name: 'zotz.flows.save',
    permission: 'workspace',
    params: ZotzFlowsSaveParams,
    handler: async ({ flow, expectedUpdatedAt }): Promise<ZotzFlowsSaveResult> =>
      flows().store.saveFlow(flow, expectedUpdatedAt)
  }),
  defineMethod({
    name: 'zotz.flows.delete',
    permission: 'workspace',
    params: ZotzFlowsDeleteParams,
    handler: async ({ id }): Promise<ZotzFlowsDeleteResult> => {
      const { store, service } = flows()
      for (const run of store.listAllRuns()) {
        if (run.flowId === id && !isFinalZotzFlowRunStatus(run.status)) {
          service.cancel(run.id)
        }
      }
      return { deleted: store.deleteFlow(id) }
    }
  }),
  // Runs commands and agents on this machine: the same permission that opens terminals.
  defineMethod({
    name: 'zotz.flows.run',
    permission: 'workspace',
    params: ZotzFlowsRunParams,
    handler: async (params): Promise<ZotzFlowsRunResult> => {
      flows()
      return { run: runZotzFlowFromRequest(params) }
    }
  }),
  defineMethod({
    name: 'zotz.flows.cancel',
    permission: 'workspace',
    params: ZotzFlowsCancelParams,
    handler: async ({ runId }): Promise<ZotzFlowsCancelResult> => ({
      run: flows().service.cancel(runId)
    })
  }),
  defineMethod({
    name: 'zotz.flows.retry',
    permission: 'workspace',
    params: ZotzFlowsRetryParams,
    handler: async ({ runId, fromNodeId }): Promise<ZotzFlowsRetryResult> => {
      flows()
      return { run: retryZotzFlowRun(runId, fromNodeId) }
    }
  }),
  defineMethod({
    name: 'zotz.flows.runs',
    permission: 'workspace',
    params: ZotzFlowsRunsParams,
    handler: async ({ flowId, limit, cursor }): Promise<ZotzFlowsRunsResult> =>
      flows().store.listRuns(flowId, limit, cursor)
  }),
  defineMethod({
    name: 'zotz.flows.runGet',
    permission: 'workspace',
    params: ZotzFlowsRunGetParams,
    handler: async ({ runId }): Promise<ZotzFlowsRunGetResult> => ({
      run: flows().store.getRun(runId)
    })
  }),
  defineMethod({
    name: 'zotz.flows.approve',
    permission: 'workspace',
    params: ZotzFlowsApproveParams,
    handler: async ({
      runId,
      nodeId,
      iteration,
      decision,
      note
    }): Promise<ZotzFlowsApproveResult> => {
      const { store, service } = flows()
      if (!service.approve(runId, nodeId, iteration, decision, note ?? null)) {
        throw new InvalidArgumentError('That step is not waiting for an approval.')
      }
      const run = store.getRun(runId)
      if (!run) {
        throw new InvalidArgumentError('This run no longer exists.')
      }
      return { run }
    }
  }),
  defineStreamingMethod({
    name: 'zotz.flows.subscribe',
    permission: 'workspace',
    params: ZotzFlowsSubscribeParams,
    handler: async ({ flowId, runId }, ctx, emit) => {
      const { store } = flows()
      const wanted = (event: ZotzFlowsStreamEvent): boolean => {
        if (event.type === 'run') {
          return (!flowId || event.run.flowId === flowId) && (!runId || event.run.id === runId)
        }
        if (runId) {
          return false
        }
        return (
          !flowId || (event.type === 'flow' ? event.flow.id === flowId : event.flowId === flowId)
        )
      }
      await new Promise<void>((resolve) => {
        const stop = store.subscribe((event) => {
          if (wanted(event)) {
            emit(event)
          }
        })
        let ended = false
        const end = (): void => {
          if (ended) {
            return
          }
          ended = true
          stop()
          ctx.signal?.removeEventListener('abort', end)
          resolve()
        }
        ctx.runtime.registerSubscriptionCleanup(
          `zotz-flows-${ctx.connectionId ?? 'inproc'}-${++subscriptionSeq}`,
          end,
          ctx.connectionId
        )
        if (ctx.signal?.aborted) {
          end()
        } else {
          ctx.signal?.addEventListener('abort', end, { once: true })
        }
      })
    }
  })
]
