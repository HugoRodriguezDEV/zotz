import type {
  ZotzSystemMonitorSnapshot,
  ZotzSystemMonitorUpdate,
  ZotzSystemProcessCloseRequest,
  ZotzSystemProcessCloseResult,
  ZotzSystemProcessList
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

export type ZotzSystemMonitorApi = {
  /** Starts sampling for this window; null when main refuses (not an app window). */
  watch: () => Promise<ZotzSystemMonitorSnapshot | null>
  unwatch: () => Promise<void>
  onChanged: (callback: (update: ZotzSystemMonitorUpdate) => void) => () => void
  /** Every process at the last sample, tagged by agent or Zotz. */
  processes: () => Promise<ZotzSystemProcessList>
  /** The full command line; null when the OS will not say. */
  processCommand: (pid: number) => Promise<string | null>
  closeProcess: (request: ZotzSystemProcessCloseRequest) => Promise<ZotzSystemProcessCloseResult>
}
