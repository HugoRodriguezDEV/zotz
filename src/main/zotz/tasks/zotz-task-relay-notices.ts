import type { ZotzRelayNotice } from '../../../shared/zotz/tasks/zotz-task-relay-types'

// Electron-free hand-off between the relay client and other main-process readers (flows).
const listeners = new Set<(notices: readonly ZotzRelayNotice[]) => void>()
const wantChanges = new Set<() => void>()
let live = false

/** Listening keeps the relay on long-poll, so notices arrive at once instead of every 10 min. */
export function subscribeZotzRelayNotices(
  listener: (notices: readonly ZotzRelayNotice[]) => void
): () => void {
  listeners.add(listener)
  for (const change of wantChanges) {
    change()
  }
  return () => {
    listeners.delete(listener)
    for (const change of wantChanges) {
      change()
    }
  }
}

export function zotzRelayNoticesWanted(): boolean {
  return listeners.size > 0
}

export function onZotzRelayNoticesWantedChanged(change: () => void): () => void {
  wantChanges.add(change)
  return () => wantChanges.delete(change)
}

export function publishZotzRelayNotices(notices: readonly ZotzRelayNotice[]): void {
  for (const listener of listeners) {
    try {
      listener(notices)
    } catch (error) {
      console.warn('[zotz-relay] a notice listener failed:', error)
    }
  }
}

/** True while the last call to the relay worked; readers fall back to polling otherwise. */
export function isZotzRelayLive(): boolean {
  return live
}

export function setZotzRelayLive(next: boolean): void {
  live = next
}
