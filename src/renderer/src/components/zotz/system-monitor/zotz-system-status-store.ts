import { useSyncExternalStore } from 'react'
import type { ZotzSystemStatus } from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

let status: ZotzSystemStatus | null = null
const listeners = new Set<() => void>()
let stopListening: (() => void) | null = null
let watching = false

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function apply(next: ZotzSystemStatus | null): void {
  if (next) {
    status = next
    emit()
  }
}

// A hidden window shows nobody the status bar, so main stops reading for it.
function syncWatch(): void {
  const api = window.api?.zotzSystemMonitor
  const want = listeners.size > 0 && document.visibilityState !== 'hidden'
  if (!api || want === watching) {
    return
  }
  watching = want
  if (want) {
    void api.watchStatus().then(apply, () => {})
  } else {
    void api.unwatchStatus().catch(() => {})
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const api = window.api?.zotzSystemMonitor
  if (!stopListening && api) {
    const stopStatus = api.onStatus(apply)
    document.addEventListener('visibilitychange', syncWatch)
    stopListening = () => {
      stopStatus()
      document.removeEventListener('visibilitychange', syncWatch)
    }
  }
  syncWatch()
  return () => {
    listeners.delete(listener)
    syncWatch()
    if (listeners.size === 0) {
      stopListening?.()
      stopListening = null
    }
  }
}

/** This machine's CPU and memory for the status bar; null until main answers. */
export function useZotzSystemStatus(): ZotzSystemStatus | null {
  return useSyncExternalStore(subscribe, () => status)
}
