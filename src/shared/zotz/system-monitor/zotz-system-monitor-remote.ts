import type {
  ZotzSystemMonitorSnapshot,
  ZotzSystemMonitorUpdate
} from './zotz-system-monitor-contract'

/** What `zotz.systemMonitor.subscribe` streams: the snapshot first, then one update per sample. */
export type ZotzSystemMonitorStreamEvent =
  | { type: 'snapshot'; snapshot: ZotzSystemMonitorSnapshot }
  | { type: 'update'; update: ZotzSystemMonitorUpdate }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// A newer or older host may add fields; only the ones the tab needs are checked.
function isReading(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.sampledAt === 'number' &&
    isRecord(value.cpu) &&
    isRecord(value.memory) &&
    isRecord(value.disk) &&
    isRecord(value.power)
  )
}

export function isZotzSystemMonitorStreamEvent(
  value: unknown
): value is ZotzSystemMonitorStreamEvent {
  if (!isRecord(value)) {
    return false
  }
  if (value.type === 'snapshot') {
    const snapshot = value.snapshot
    return (
      isRecord(snapshot) &&
      Array.isArray(snapshot.history) &&
      typeof snapshot.historyMs === 'number' &&
      typeof snapshot.intervalMs === 'number' &&
      (snapshot.latest === null || isReading(snapshot.latest))
    )
  }
  return (
    value.type === 'update' &&
    isRecord(value.update) &&
    isReading(value.update.latest) &&
    (value.update.sample === null || isRecord(value.update.sample))
  )
}
