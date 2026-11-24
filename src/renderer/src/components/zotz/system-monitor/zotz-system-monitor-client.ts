import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type {
  ZotzSystemProcessCloseRequest,
  ZotzSystemProcessCloseResult,
  ZotzSystemProcessList
} from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

/** Where the Processes view reads and closes: this machine over IPC, or a server over the runtime RPC. */
export type ZotzSystemMonitorClient = {
  processes: () => Promise<ZotzSystemProcessList>
  processCommand: (pid: number) => Promise<string | null>
  /** Null when the machine does not accept closing processes from here. */
  closeProcess:
    | ((request: ZotzSystemProcessCloseRequest) => Promise<ZotzSystemProcessCloseResult>)
    | null
}

const EMPTY_LIST: ZotzSystemProcessList = { sampledAt: null, processes: [] }

export const LOCAL_ZOTZ_SYSTEM_MONITOR_CLIENT: ZotzSystemMonitorClient = {
  processes: async () => (await window.api?.zotzSystemMonitor?.processes()) ?? EMPTY_LIST,
  processCommand: async (pid) => (await window.api?.zotzSystemMonitor?.processCommand(pid)) ?? null,
  closeProcess: async (request) =>
    (await window.api?.zotzSystemMonitor?.closeProcess(request)) ?? { ok: false, reason: 'failed' }
}

export function remoteZotzSystemMonitorClient(
  environmentId: string,
  canClose: boolean
): ZotzSystemMonitorClient {
  const target = { kind: 'environment', environmentId } as const
  return {
    processes: () =>
      callRuntimeRpc<ZotzSystemProcessList>(
        target,
        'zotz.systemMonitor.processes',
        {},
        {
          timeoutMs: 15_000
        }
      ),
    processCommand: (pid) =>
      callRuntimeRpc<string | null>(
        target,
        'zotz.systemMonitor.processCommand',
        { pid },
        {
          timeoutMs: 10_000
        }
      ),
    closeProcess: canClose
      ? (request) =>
          callRuntimeRpc<ZotzSystemProcessCloseResult>(
            target,
            'zotz.systemMonitor.closeProcess',
            request,
            { timeoutMs: 20_000 }
          ).catch((): ZotzSystemProcessCloseResult => ({ ok: false, reason: 'failed' }))
      : null
  }
}
