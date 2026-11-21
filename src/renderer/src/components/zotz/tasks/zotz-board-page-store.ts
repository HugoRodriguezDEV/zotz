import { useAppStore } from '@/store/index'
import type { TopLevelView } from '../../../../../shared/ui-chrome-types'

const ZOTZ_BOARD_VIEW = 'zotz-board'

let returnView: Exclude<TopLevelView, typeof ZOTZ_BOARD_VIEW> = 'terminal'

export function openZotzBoard(): void {
  const { activeView, setActiveView } = useAppStore.getState()
  if (activeView !== ZOTZ_BOARD_VIEW) {
    returnView = activeView
  }
  setActiveView(ZOTZ_BOARD_VIEW)
}

export function closeZotzBoard(): void {
  const { activeView, setActiveView } = useAppStore.getState()
  if (activeView === ZOTZ_BOARD_VIEW) {
    setActiveView(returnView)
  }
}

export function toggleZotzBoard(): void {
  if (useAppStore.getState().activeView === ZOTZ_BOARD_VIEW) {
    closeZotzBoard()
  } else {
    openZotzBoard()
  }
}

/** Whether the task board page is showing; any surface can open it (sidebar, shortcut, command). */
export function useZotzBoardOpen(): boolean {
  return useAppStore((s) => s.activeView === ZOTZ_BOARD_VIEW)
}
