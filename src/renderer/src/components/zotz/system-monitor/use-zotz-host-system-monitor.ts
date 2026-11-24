import { useEffect, useState } from 'react'
import { getRuntimeEnvironmentRevision } from '@/runtime/rpc/environment-revisions/runtime-environment-revision'
import { subscribeRuntimeEnvironment } from '@/runtime/rpc/environment-revisions/runtime-environment-pairing-refresh'
import type { ZotzSystemMonitorSnapshot } from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { isZotzSystemMonitorStreamEvent } from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-remote'

/**
 * A server's System tab, streamed while mounted: the server samples itself only while this
 * stream is open, the same rule as a local window (docs/zotz/SPEC-monitor-y-remotos.md §A.5).
 */
export function useZotzHostSystemMonitor(environmentId: string | null): {
  snapshot: ZotzSystemMonitorSnapshot | null
  failed: boolean
} {
  const [state, setState] = useState<{
    environmentId: string | null
    snapshot: ZotzSystemMonitorSnapshot | null
    failed: boolean
  }>({ environmentId: null, snapshot: null, failed: false })
  useEffect(() => {
    if (!environmentId) {
      return
    }
    let disposed = false
    let unsubscribe: (() => void) | null = null
    setState({ environmentId, snapshot: null, failed: false })
    subscribeRuntimeEnvironment(
      {
        selector: environmentId,
        method: 'zotz.systemMonitor.subscribe',
        timeoutMs: 15_000,
        expectedEnvironmentPairingRevision: getRuntimeEnvironmentRevision(environmentId)
      },
      {
        onResponse: (response) => {
          if (
            disposed ||
            response.ok === false ||
            !isZotzSystemMonitorStreamEvent(response.result)
          ) {
            return
          }
          const event = response.result
          setState((current) => {
            if (event.type === 'snapshot') {
              return { environmentId, snapshot: event.snapshot, failed: false }
            }
            const snapshot = current.snapshot
            if (!snapshot) {
              return current
            }
            const oldest = event.update.latest.sampledAt - snapshot.historyMs
            return {
              environmentId,
              failed: false,
              snapshot: {
                ...snapshot,
                latest: event.update.latest,
                history: event.update.sample
                  ? [
                      ...snapshot.history.filter((sample) => sample.t >= oldest),
                      event.update.sample
                    ]
                  : snapshot.history
              }
            }
          })
        },
        onError: () => {
          if (!disposed) {
            setState((current) => ({ ...current, failed: true }))
          }
        },
        onClose: () => {}
      }
    ).then(
      (handle) => {
        if (disposed) {
          handle.unsubscribe()
        } else {
          unsubscribe = () => handle.unsubscribe()
        }
      },
      () => {
        if (!disposed) {
          setState((current) => ({ ...current, failed: true }))
        }
      }
    )
    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [environmentId])
  return state.environmentId === environmentId
    ? { snapshot: state.snapshot, failed: state.failed }
    : { snapshot: null, failed: false }
}
