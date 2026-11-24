import type {
  ZotzSystemMonitorSnapshot,
  ZotzSystemMonitorUpdate
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

export type ZotzSystemMonitorApi = {
  /** Starts sampling for this window; null when main refuses (not an app window). */
  watch: () => Promise<ZotzSystemMonitorSnapshot | null>
  unwatch: () => Promise<void>
  onChanged: (callback: (update: ZotzSystemMonitorUpdate) => void) => () => void
}
