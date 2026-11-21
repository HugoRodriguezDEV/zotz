import { OverlayBoundary } from '@/app-shell/app-root-surface-boundaries'
import { ZotzMachineModeGate } from './ZotzMachineModeGate'

/** App-wide Zotz overlays, mounted once from the app root. */
export function ZotzRootOverlays({
  onboardingVisible
}: {
  onboardingVisible: boolean
}): React.JSX.Element {
  return (
    <OverlayBoundary boundaryId="overlay.zotz-machine-mode">
      <ZotzMachineModeGate onboardingVisible={onboardingVisible} />
    </OverlayBoundary>
  )
}
