import { create } from 'zustand'
import type { DictationInsertionTarget } from '../../dictation/dictation-insertion-target'

type ZotzDictationPreviewTarget = {
  target: DictationInsertionTarget
  /** AI cleanup holds every final until the end, so the preview shows them too. */
  holding: boolean
}

/** Where the current dictation lands, so its live words can be drawn there; null between dictations. */
export const useZotzDictationPreviewTarget = create<{ current: ZotzDictationPreviewTarget | null }>(
  () => ({ current: null })
)

export function setZotzDictationPreviewTarget(current: ZotzDictationPreviewTarget | null): void {
  useZotzDictationPreviewTarget.setState({ current })
}
