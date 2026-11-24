import type {
  ZotzSystemMonitorSnapshot,
  ZotzSystemMonitorUpdate,
  ZotzSystemProcessCloseRequest,
  ZotzSystemProcessCloseResult,
  ZotzSystemProcessList,
  ZotzSystemStatus
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
  /** The status bar's CPU and memory; main reads them only while some window watches. */
  watchStatus: () => Promise<ZotzSystemStatus | null>
  unwatchStatus: () => Promise<void>
  onStatus: (callback: (status: ZotzSystemStatus) => void) => () => void
}
