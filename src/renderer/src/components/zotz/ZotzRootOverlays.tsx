import { OverlayBoundary } from '@/app-shell/app-root-surface-boundaries'
import { ZotzMachineModeGate } from './ZotzMachineModeGate'
import { ZotzBoardModal } from './tasks/ZotzBoardModal'

/** App-wide Zotz overlays, mounted once from the app root. */
export function ZotzRootOverlays({
  onboardingVisible
}: {
  onboardingVisible: boolean
}): React.JSX.Element {
  return (
    <>
      <OverlayBoundary boundaryId="overlay.zotz-machine-mode">
        <ZotzMachineModeGate onboardingVisible={onboardingVisible} />
      </OverlayBoundary>
      <OverlayBoundary boundaryId="overlay.zotz-board">
        <ZotzBoardModal />
      </OverlayBoundary>
    </>
  )
}
