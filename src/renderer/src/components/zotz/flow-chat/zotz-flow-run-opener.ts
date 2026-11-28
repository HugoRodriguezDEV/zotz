import { useSyncExternalStore } from 'react'

/** A run as the Flows page addresses it: the machine's execution host id, the flow and the run. */
export type ZotzFlowRunAddress = { hostId: string; flowId: string; runId: string }

type Opener = (address: ZotzFlowRunAddress) => void

// The Flows page (Fase 10, part 2) registers how it shows one run; until it does, cards offer no link.
let opener: Opener | null = null
const listeners = new Set<() => void>()

export function registerZotzFlowRunOpener(next: Opener): () => void {
  opener = next
  listeners.forEach((listener) => listener())
  return () => {
    if (opener === next) {
      opener = null
      listeners.forEach((listener) => listener())
    }
  }
}

export function useZotzFlowRunOpener(): Opener | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => opener
  )
}
