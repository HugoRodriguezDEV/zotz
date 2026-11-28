import { useAppStore } from '@/store/index'
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
