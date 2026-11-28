import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { getRuntimeEnvironmentRevision } from '@/runtime/rpc/environment-revisions/runtime-environment-revision'
import { subscribeRuntimeEnvironment } from '@/runtime/rpc/environment-revisions/runtime-environment-pairing-refresh'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId
} from '../../../../../shared/execution-host'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { ZotzFlowChatContext } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowInputValues } from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import type {
  ZotzFlowsCancelResult,
  ZotzFlowsChatRunsResult,
  ZotzFlowsListResult,
  ZotzFlowsRunResult,
  ZotzFlowsStreamEvent
} from '../../../../../shared/rpc-contract/zotz/zotz-flows-params'

/** A machine whose flows a chat lists: this app, or the paired server the chat runs on. */
export type ZotzFlowChatMachine = {
  /** Execution host id, as the Flows page names machines (`local` or `runtime:<id>`). */
  hostId: string
  environmentId: string | null
}

/** The chat's machine first, then this one (spec §6): a slug on both resolves to the chat's. */
export function zotzFlowChatMachines(environmentId: string | null): ZotzFlowChatMachine[] {
  const local: ZotzFlowChatMachine = { hostId: LOCAL_EXECUTION_HOST_ID, environmentId: null }
  return environmentId
    ? [{ hostId: toRuntimeExecutionHostId(environmentId), environmentId }, local]
    : [local]
}

function targetOf(machine: ZotzFlowChatMachine): RuntimeClientTarget {
  return machine.environmentId
    ? { kind: 'environment', environmentId: machine.environmentId }
    : { kind: 'local' }
}

export const zotzFlowChatRpc = {
  list: (machine: ZotzFlowChatMachine) =>
    callRuntimeRpc<ZotzFlowsListResult>(targetOf(machine), 'zotz.flows.list', {}),
  run: (
    machine: ZotzFlowChatMachine,
    params: {
      id: string
      triggerId: string
      text: string
      inputs: ZotzFlowInputValues
      chat: ZotzFlowChatContext
    }
  ) => callRuntimeRpc<ZotzFlowsRunResult>(targetOf(machine), 'zotz.flows.run', params),
  cancel: (machine: ZotzFlowChatMachine, runId: string) =>
    callRuntimeRpc<ZotzFlowsCancelResult>(targetOf(machine), 'zotz.flows.cancel', { runId }),
  chatRuns: (machine: ZotzFlowChatMachine, chatSessionId: string) =>
    callRuntimeRpc<ZotzFlowsChatRunsResult>(targetOf(machine), 'zotz.flows.chatRuns', {
      chatSessionId
    })
}

function isStreamEvent(value: unknown): value is ZotzFlowsStreamEvent {
  return typeof value === 'object' && value !== null && 'type' in value
}

/** Every flow and run change on one machine, until the returned function is called. */
export function subscribeZotzFlowChatMachine(
  machine: ZotzFlowChatMachine,
  onEvent: (event: ZotzFlowsStreamEvent) => void
): () => void {
  let disposed = false
  let unsubscribe: (() => void) | null = null
  const onResponse = (response: { ok: boolean; result?: unknown }): void => {
    if (!disposed && response.ok && isStreamEvent(response.result)) {
      onEvent(response.result)
    }
  }
  const request = machine.environmentId
    ? subscribeRuntimeEnvironment(
        {
          selector: machine.environmentId,
          method: 'zotz.flows.subscribe',
          params: {},
          timeoutMs: 15_000,
          expectedEnvironmentPairingRevision: getRuntimeEnvironmentRevision(machine.environmentId)
        },
        { onResponse, onError: () => {}, onClose: () => {} }
      )
    : window.api.runtime.subscribe({ method: 'zotz.flows.subscribe', params: {} }, onResponse)
  request.then(
    (handle) => {
      if (disposed) {
        handle.unsubscribe()
      } else {
        unsubscribe = () => handle.unsubscribe()
      }
    },
    // A server without flows refuses the stream; its cards then stay as last read.
    () => {}
  )
  return () => {
    disposed = true
    unsubscribe?.()
  }
}
