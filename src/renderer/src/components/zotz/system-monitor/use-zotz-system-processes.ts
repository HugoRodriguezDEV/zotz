import { useEffect, useState } from 'react'
import type { ZotzSystemProcessList } from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import type { ZotzSystemMonitorClient } from './zotz-system-monitor-client'

/** The full process list, read again each time main samples processes (no timer of its own). */
export function useZotzSystemProcesses(
  sampledAt: number | null,
  client: ZotzSystemMonitorClient
): ZotzSystemProcessList | null {
  const [list, setList] = useState<ZotzSystemProcessList | null>(null)
  useEffect(() => {
    if (sampledAt === null) {
      return
    }
    let cancelled = false
    void client.processes().then(
      (next) => {
        if (!cancelled) {
          setList(next)
        }
      },
      () => {}
    )
    return () => {
      cancelled = true
    }
  }, [sampledAt, client])
  return list
}
