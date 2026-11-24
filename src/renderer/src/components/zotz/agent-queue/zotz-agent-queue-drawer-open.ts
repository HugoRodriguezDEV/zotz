import { useSyncExternalStore } from 'react'

export type ZotzAgentQueueDrawerTab = 'queue' | 'system'

// Whether the queue board is open beside the sidebar, and on which tab; window-local, never persisted.
let open = false
let tab: ZotzAgentQueueDrawerTab = 'queue'
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setZotzAgentQueueDrawerOpen(next: boolean): void {
  if (open === next) {
    return
  }
  open = next
  emit()
}

export function setZotzAgentQueueDrawerTab(next: ZotzAgentQueueDrawerTab): void {
  if (tab === next) {
    return
  }
  tab = next
  emit()
}

/** Opens the board straight on a tab, e.g. System from the status bar's CPU · MEM. */
export function openZotzAgentQueueDrawer(next: ZotzAgentQueueDrawerTab): void {
  tab = next
  open = true
  emit()
}

export function useZotzAgentQueueDrawerOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open)
}

export function useZotzAgentQueueDrawerTab(): ZotzAgentQueueDrawerTab {
  return useSyncExternalStore(subscribe, () => tab)
}
