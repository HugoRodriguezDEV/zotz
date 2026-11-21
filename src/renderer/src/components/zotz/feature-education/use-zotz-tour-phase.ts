import { useEffect, useState } from 'react'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'

/** Steps a storyboard through `count` phases and loops; reduced motion holds the last, most telling one. */
export function useZotzTourPhase(count: number, stepMs: number, reducedMotion: boolean): number {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (reducedMotion) {
      return
    }
    // Stops while the window is hidden, like the gallery's other storyboards.
    return installWindowVisibilityInterval({
      run: () => setPhase((current) => (current + 1) % count),
      runOnVisible: () => {},
      intervalMs: stepMs
    })
  }, [count, stepMs, reducedMotion])
  return reducedMotion ? count - 1 : phase
}
