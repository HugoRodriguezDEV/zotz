import { useEffect, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store/index'
import {
  registerZotzFlowRunOpener,
  type ZotzFlowRunAddress
} from '../flow-chat/zotz-flow-run-opener'
import type { TopLevelView } from '../../../../../shared/ui-chrome-types'

const ZOTZ_FLOWS_VIEW = 'zotz-flows'

let returnView: Exclude<TopLevelView, typeof ZOTZ_FLOWS_VIEW> = 'terminal'

export function openZotzFlows(): void {
  const { activeView, setActiveView } = useAppStore.getState()
  if (activeView !== ZOTZ_FLOWS_VIEW) {
    returnView = activeView
  }
  setActiveView(ZOTZ_FLOWS_VIEW)
}

export function closeZotzFlows(): void {
  const { activeView, setActiveView } = useAppStore.getState()
  if (activeView === ZOTZ_FLOWS_VIEW) {
    setActiveView(returnView)
  }
}

export function useZotzFlowsOpen(): boolean {
  return useAppStore((s) => s.activeView === ZOTZ_FLOWS_VIEW)
}

// A run the chat asked to show; the page takes it once that flow's machine has listed it.
let pendingRun: ZotzFlowRunAddress | null = null
const pendingListeners = new Set<() => void>()

function setPendingRun(next: ZotzFlowRunAddress | null): void {
  pendingRun = next
  pendingListeners.forEach((listener) => listener())
}

export function openZotzFlowRun(address: ZotzFlowRunAddress): void {
  setPendingRun(address)
  openZotzFlows()
}

export function takeZotzFlowsPendingRun(address: ZotzFlowRunAddress): void {
  if (pendingRun === address) {
    setPendingRun(null)
  }
}

export function useZotzFlowsPendingRun(): ZotzFlowRunAddress | null {
  return useSyncExternalStore(
    (listener) => {
      pendingListeners.add(listener)
      return () => pendingListeners.delete(listener)
    },
    () => pendingRun
  )
}

/** "View run" on a chat's flow card opens that run on this page; mounted once at the app root. */
export function useZotzFlowRunOpenerRegistration(): void {
  useEffect(() => registerZotzFlowRunOpener(openZotzFlowRun), [])
}

/** The Automations page is hidden in Zotz (plan rule 4, spec §8): whatever opens it lands on Flows. */
export function useZotzAutomationsPageRedirect(): void {
  useEffect(() => {
    const redirect = (view: TopLevelView): void => {
      if (view !== 'automations') {
        return
      }
      const { previousViewBeforeAutomations, setActiveView } = useAppStore.getState()
      returnView =
        previousViewBeforeAutomations === ZOTZ_FLOWS_VIEW
          ? 'terminal'
          : previousViewBeforeAutomations
      setActiveView(ZOTZ_FLOWS_VIEW)
    }
    redirect(useAppStore.getState().activeView)
    return useAppStore.subscribe((state, previous) => {
      if (state.activeView !== previous.activeView) {
        redirect(state.activeView)
      }
    })
  }, [])
}
