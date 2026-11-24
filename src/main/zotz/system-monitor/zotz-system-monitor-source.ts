import type {
  ZotzSystemProcessCloseRequest,
  ZotzSystemProcessCloseResult
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import type { ZotzSystemMonitorService } from './zotz-system-monitor-service'

export type ZotzSystemMonitorSource = {
  service: Pick<ZotzSystemMonitorService, 'watch' | 'unwatch' | 'onUpdate' | 'processList'>
  processCommand: (pid: number) => Promise<string | null>
  closeProcess: (request: ZotzSystemProcessCloseRequest) => Promise<ZotzSystemProcessCloseResult>
}

let source: ZotzSystemMonitorSource | null = null

/** What the runtime RPC reads, so a paired client sees this machine (docs/zotz/SPEC-monitor-y-remotos.md §A.5). */
export function registerZotzSystemMonitorSource(next: ZotzSystemMonitorSource): () => void {
  source = next
  return () => {
    if (source === next) {
      source = null
    }
  }
}

export function getZotzSystemMonitorSource(): ZotzSystemMonitorSource | null {
  return source
}
