import { useEffect, useState } from 'react'
import type { ZotzSystemProcessList } from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

/** The full process list, read again each time main samples processes (no timer of its own). */
export function useZotzSystemProcesses(sampledAt: number | null): ZotzSystemProcessList | null {
  const [list, setList] = useState<ZotzSystemProcessList | null>(null)
  useEffect(() => {
    const api = window.api?.zotzSystemMonitor
    if (!api) {
      return
    }
    let cancelled = false
    void api.processes().then(
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
  }, [sampledAt])
  return list
}
