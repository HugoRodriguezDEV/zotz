import { useSyncExternalStore } from 'react'

let open = false
const listeners = new Set<() => void>()

function publish(next: boolean): void {
  if (open === next) {
    return
  }
  open = next
  for (const listener of listeners) {
    listener()
  }
}

export function openZotzBoard(): void {
  publish(true)
}

export function closeZotzBoard(): void {
  publish(false)
}

export function toggleZotzBoard(): void {
  publish(!open)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether the task board modal is open; any surface can open it (sidebar, shortcut, command). */
export function useZotzBoardOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open)
}
