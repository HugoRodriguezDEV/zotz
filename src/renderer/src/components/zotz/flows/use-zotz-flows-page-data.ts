import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import type { ZotzFlow } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowRun } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import { normalizeExecutionHostId } from '../../../../../shared/execution-host'
import { subscribeZotzFlows, zotzFlowsRpc } from './zotz-flows-rpc'

export type ZotzFlowsHostState = { flows: ZotzFlow[]; loading: boolean; error: string | null }

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// A server only knows itself as `local` (a flow it migrated); clients address it by their own id.
function onHost(flow: ZotzFlow, hostId: string): ZotzFlow {
  const listedOn = normalizeExecutionHostId(hostId)
  return !listedOn || flow.hostId === listedOn ? flow : { ...flow, hostId: listedOn }
}

/** Flows of every machine, kept current by each machine's stream. */
export function useZotzFlowsPageData(
  hostIds: readonly string[],
  onRun: (run: ZotzFlowRun) => void
) {
  const [byHost, setByHost] = useState<Record<string, ZotzFlowsHostState>>({})
  const key = hostIds.join('\n')
  const handleRun = useEffectEvent(onRun)

  const load = useCallback((hostId: string) => {
    setByHost((current) => ({
      ...current,
      [hostId]: { flows: current[hostId]?.flows ?? [], loading: true, error: null }
    }))
    zotzFlowsRpc.list(hostId).then(
      ({ flows }) =>
        setByHost((current) => ({
          ...current,
          [hostId]: {
            flows: flows.map((flow) => onHost(flow, hostId)),
            loading: false,
            error: null
          }
        })),
      (error: unknown) =>
        setByHost((current) => ({
          ...current,
          [hostId]: { flows: current[hostId]?.flows ?? [], loading: false, error: message(error) }
        }))
    )
  }, [])

  useEffect(() => {
    const ids = key ? key.split('\n') : []
    ids.forEach(load)
    const stops = ids.map((hostId) =>
      subscribeZotzFlows(hostId, {}, (event) => {
        if (event.type === 'run') {
          handleRun(event.run)
          return
        }
        setByHost((current) => {
          const state = current[hostId] ?? { flows: [], loading: false, error: null }
          const others = state.flows.filter(
            (flow) => flow.id !== (event.type === 'flow' ? event.flow.id : event.flowId)
          )
          return {
            ...current,
            [hostId]: {
              ...state,
              flows: event.type === 'flow' ? [...others, onHost(event.flow, hostId)] : others
            }
          }
        })
      })
    )
    return () => stops.forEach((stop) => stop())
  }, [key, load])

  const upsert = useCallback((flow: ZotzFlow) => {
    setByHost((current) => {
      const state = current[flow.hostId] ?? { flows: [], loading: false, error: null }
      return {
        ...current,
        [flow.hostId]: {
          ...state,
          flows: [...state.flows.filter((item) => item.id !== flow.id), flow]
        }
      }
    })
  }, [])

  const remove = useCallback((hostId: string, flowId: string) => {
    setByHost((current) => {
      const state = current[hostId]
      return state
        ? {
            ...current,
            [hostId]: { ...state, flows: state.flows.filter((flow) => flow.id !== flowId) }
          }
        : current
    })
  }, [])

  return { byHost, load, upsert, remove }
}
