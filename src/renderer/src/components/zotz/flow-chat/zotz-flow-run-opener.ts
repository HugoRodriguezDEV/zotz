import { useSyncExternalStore } from 'react'

/** A run as the Flows page addresses it: the machine's execution host id, the flow and the run. */
export type ZotzFlowRunAddress = { hostId: string; flowId: string; runId: string }

type Opener = (address: ZotzFlowRunAddress) => void

// The Flows page registers how it shows one run (zotz-flows-page-store); until then cards offer no link.
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
