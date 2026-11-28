import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { getRuntimeEnvironmentRevision } from '@/runtime/rpc/environment-revisions/runtime-environment-revision'
import { subscribeRuntimeEnvironment } from '@/runtime/rpc/environment-revisions/runtime-environment-pairing-refresh'
import {
  LOCAL_EXECUTION_HOST_ID,
  parseRoutableExecutionHostId
} from '../../../../../shared/execution-host'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowsApproveResult,
  ZotzFlowsCancelResult,
  ZotzFlowsDeleteResult,
  ZotzFlowsListResult,
  ZotzFlowsRetryResult,
  ZotzFlowsRunGetResult,
  ZotzFlowsRunResult,
  ZotzFlowsRunsResult,
  ZotzFlowsSaveResult,
  ZotzFlowsStreamEvent
} from '../../../../../shared/rpc-contract/zotz/zotz-flows-params'

/** A flow lives on this app or on a paired server; SSH hosts run no Zotz of their own. */
export function zotzFlowsTarget(hostId: string): RuntimeClientTarget | null {
  if (hostId === LOCAL_EXECUTION_HOST_ID) {
    return { kind: 'local' }
  }
  const parsed = parseRoutableExecutionHostId(hostId)
  return parsed?.kind === 'runtime'
    ? { kind: 'environment', environmentId: parsed.environmentId }
    : null
}

function call<T>(hostId: string, method: string, params: unknown): Promise<T> {
  const target = zotzFlowsTarget(hostId)
  if (!target) {
    return Promise.reject(new Error('Flows run only on Zotz machines.'))
  }
  return callRuntimeRpc<T>(target, method, params)
}

export const zotzFlowsRpc = {
  list: (hostId: string) => call<ZotzFlowsListResult>(hostId, 'zotz.flows.list', {}),
  save: (hostId: string, flow: ZotzFlowDraft, expectedUpdatedAt: number | null) =>
    call<ZotzFlowsSaveResult>(hostId, 'zotz.flows.save', { flow, expectedUpdatedAt }),
  delete: (hostId: string, id: string) =>
    call<ZotzFlowsDeleteResult>(hostId, 'zotz.flows.delete', { id }),
  run: (hostId: string, id: string) => call<ZotzFlowsRunResult>(hostId, 'zotz.flows.run', { id }),
  cancel: (hostId: string, runId: string) =>
    call<ZotzFlowsCancelResult>(hostId, 'zotz.flows.cancel', { runId }),
  retry: (hostId: string, runId: string, fromNodeId?: string) =>
    call<ZotzFlowsRetryResult>(hostId, 'zotz.flows.retry', { runId, fromNodeId }),
  runs: (hostId: string, flowId: string) =>
    call<ZotzFlowsRunsResult>(hostId, 'zotz.flows.runs', { flowId, limit: 50 }),
  runGet: (hostId: string, runId: string) =>
    call<ZotzFlowsRunGetResult>(hostId, 'zotz.flows.runGet', { runId }),
  approve: (
    hostId: string,
    params: {
      runId: string
      nodeId: string
      iteration: number[]
      decision: 'approved' | 'rejected'
    }
  ) => call<ZotzFlowsApproveResult>(hostId, 'zotz.flows.approve', params)
}

/** Streams flow and run changes of one host until the returned function is called. */
export function subscribeZotzFlows(
  hostId: string,
  params: { flowId?: string },
  onEvent: (event: ZotzFlowsStreamEvent) => void
): () => void {
  const target = zotzFlowsTarget(hostId)
  if (!target) {
    return () => {}
  }
  let disposed = false
  let unsubscribe: (() => void) | null = null
  const onResponse = (response: { ok: boolean; result?: unknown }): void => {
    if (!disposed && response.ok && isStreamEvent(response.result)) {
      onEvent(response.result)
    }
  }
  const request =
    target.kind === 'local'
      ? window.api.runtime.subscribe({ method: 'zotz.flows.subscribe', params }, onResponse)
      : subscribeRuntimeEnvironment(
          {
            selector: target.environmentId,
            method: 'zotz.flows.subscribe',
            params,
            timeoutMs: 15_000,
            expectedEnvironmentPairingRevision: getRuntimeEnvironmentRevision(target.environmentId)
          },
          { onResponse, onError: () => {}, onClose: () => {} }
        )
  request.then(
    (handle) => {
      if (disposed) {
        handle.unsubscribe()
      } else {
        unsubscribe = () => handle.unsubscribe()
      }
    },
    // Hosts without the flows engine refuse the stream; the page already shows the list error.
    () => {}
  )
  return () => {
    disposed = true
    unsubscribe?.()
  }
}

function isStreamEvent(value: unknown): value is ZotzFlowsStreamEvent {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const type = 'type' in value ? value.type : undefined
  return type === 'flow' || type === 'flow_deleted' || type === 'run'
}
