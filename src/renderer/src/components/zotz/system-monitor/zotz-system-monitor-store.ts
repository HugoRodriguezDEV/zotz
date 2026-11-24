import { useSyncExternalStore } from 'react'
import type {
  ZotzSystemMonitorSnapshot,
  ZotzSystemMonitorUpdate
} from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

let snapshot: ZotzSystemMonitorSnapshot | null = null
const listeners = new Set<() => void>()
let stopListening: (() => void) | null = null

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function applyUpdate(update: ZotzSystemMonitorUpdate): void {
  if (!snapshot) {
    return
  }
  const oldest = update.latest.sampledAt - snapshot.historyMs
  snapshot = {
    ...snapshot,
    latest: update.latest,
    history: update.sample
      ? [...snapshot.history.filter((sample) => sample.t >= oldest), update.sample]
      : snapshot.history
  }
  emit()
}

// Main samples the machine only while a window holds a watch; the last reader releases it.
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const api = window.api?.zotzSystemMonitor
  if (!stopListening && api) {
    stopListening = api.onChanged(applyUpdate)
    void api.watch().then(
      (next) => {
        if (next && stopListening) {
          snapshot = next
          emit()
        }
      },
      () => {}
    )
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && stopListening) {
      stopListening()
      stopListening = null
      void api?.unwatch().catch(() => {})
    }
  }
}

/** The machine's vitals while mounted; null until main answers. */
export function useZotzSystemMonitor(): ZotzSystemMonitorSnapshot | null {
  return useSyncExternalStore(subscribe, () => snapshot)
}
