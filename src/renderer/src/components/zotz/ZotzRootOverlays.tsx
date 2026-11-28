import { OverlayBoundary } from '@/app-shell/app-root-surface-boundaries'
import { ZotzMachineModeGate } from './ZotzMachineModeGate'
import { useZotzDictationLanguageUpgrade } from './dictation/use-zotz-dictation-language-upgrade'
import { ZotzDictationLivePreview } from './dictation/ZotzDictationLivePreview'
import { useZotzFlowRunOpenerRegistration } from './flows/zotz-flows-page-store'

/** App-wide Zotz overlays, mounted once from the app root. */
export function ZotzRootOverlays({
  onboardingVisible
}: {
  onboardingVisible: boolean
}): React.JSX.Element {
  useZotzDictationLanguageUpgrade()
  useZotzFlowRunOpenerRegistration()
  return (
    <OverlayBoundary boundaryId="overlay.zotz-machine-mode">
      <ZotzMachineModeGate onboardingVisible={onboardingVisible} />
      <ZotzDictationLivePreview />
    </OverlayBoundary>
  )
}
