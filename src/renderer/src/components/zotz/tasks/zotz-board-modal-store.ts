import { useSyncExternalStore } from 'react'

export type ZotzBoardTab = 'tasks' | 'agents'

export type ZotzBoardModalState = {
  open: boolean
  tab: ZotzBoardTab
}

let state: ZotzBoardModalState = { open: false, tab: 'tasks' }
const listeners = new Set<() => void>()

function publish(next: ZotzBoardModalState): void {
  state = next
  for (const listener of listeners) {
    listener()
  }
}

export function openZotzBoard(tab: ZotzBoardTab): void {
  publish({ open: true, tab })
}

export function closeZotzBoard(): void {
  if (state.open) {
    publish({ ...state, open: false })
  }
}

export function setZotzBoardTab(tab: ZotzBoardTab): void {
  if (state.tab !== tab) {
    publish({ ...state, tab })
  }
}

/** Closes only when the modal already shows this tab; otherwise opens it there. */
export function toggleZotzBoard(tab: ZotzBoardTab): void {
  if (state.open && state.tab === tab) {
    closeZotzBoard()
    return
  }
  openZotzBoard(tab)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useZotzBoardModal(): ZotzBoardModalState {
  return useSyncExternalStore(subscribe, () => state)
}
