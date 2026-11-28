import { defineMethod, defineStreamingMethod } from '../../core'
import {
  ZotzSystemMonitorCloseProcessParams,
  ZotzSystemMonitorProcessesParams,
  ZotzSystemMonitorProcessParams,
  ZotzSystemMonitorSubscribeParams
} from '../../../../../shared/rpc-contract/zotz/zotz-system-monitor-params'
import { getZotzSystemMonitorSource } from '../../../../zotz/system-monitor/zotz-system-monitor-source'

let subscriptionSeq = 0
// Window watchers use webContents ids (small integers); remote watchers sit far above them.
let remoteWatcherId = 1_000_000_000

/**
 * A paired client watching this machine's System tab: sampling runs while the stream is open,
 * exactly as for a local window (docs/zotz/specs/SPEC-monitor-y-remotos.md §A.5).
 */
export const ZOTZ_SYSTEM_MONITOR_SUBSCRIBE_METHOD = defineStreamingMethod({
  name: 'zotz.systemMonitor.subscribe',
  permission: 'workspace',
  params: ZotzSystemMonitorSubscribeParams,
  handler: async (_params, ctx, emit) => {
    const source = getZotzSystemMonitorSource()
    if (!source) {
      return
    }
    const watcherId = ++remoteWatcherId
    const stopUpdates = source.service.onUpdate((update) => emit({ type: 'update', update }))
    emit({ type: 'snapshot', snapshot: source.service.watch(watcherId) })
    await new Promise<void>((resolve) => {
      let ended = false
      const end = (): void => {
        if (ended) {
          return
        }
        ended = true
        stopUpdates()
        source.service.unwatch(watcherId)
        ctx.signal?.removeEventListener('abort', end)
        resolve()
      }
      ctx.runtime.registerSubscriptionCleanup(
        `zotz-system-monitor-${ctx.connectionId ?? 'inproc'}-${++subscriptionSeq}`,
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

export const ZOTZ_SYSTEM_MONITOR_PROCESSES_METHOD = defineMethod({
  name: 'zotz.systemMonitor.processes',
  permission: 'workspace',
  params: ZotzSystemMonitorProcessesParams,
  handler: async () =>
    getZotzSystemMonitorSource()?.service.processList() ?? { sampledAt: null, processes: [] }
})

export const ZOTZ_SYSTEM_MONITOR_PROCESS_COMMAND_METHOD = defineMethod({
  name: 'zotz.systemMonitor.processCommand',
  permission: 'workspace',
  params: ZotzSystemMonitorProcessParams,
  handler: async ({ pid }) => (await getZotzSystemMonitorSource()?.processCommand(pid)) ?? null
})

// Same permission that opens terminals on this host: whoever may run commands here may close one.
export const ZOTZ_SYSTEM_MONITOR_CLOSE_PROCESS_METHOD = defineMethod({
  name: 'zotz.systemMonitor.closeProcess',
  permission: 'workspace',
  params: ZotzSystemMonitorCloseProcessParams,
  handler: async (request) =>
    (await getZotzSystemMonitorSource()?.closeProcess(request)) ?? {
      ok: false,
      reason: 'failed'
    }
})

export const ZOTZ_SYSTEM_MONITOR_METHODS = [
  ZOTZ_SYSTEM_MONITOR_SUBSCRIBE_METHOD,
  ZOTZ_SYSTEM_MONITOR_PROCESSES_METHOD,
  ZOTZ_SYSTEM_MONITOR_PROCESS_COMMAND_METHOD,
  ZOTZ_SYSTEM_MONITOR_CLOSE_PROCESS_METHOD
]
