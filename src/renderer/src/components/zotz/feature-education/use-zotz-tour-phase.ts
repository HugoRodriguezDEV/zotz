import { useEffect, useState } from 'react'

/** Steps a storyboard through `count` phases and loops; reduced motion holds the last, most telling one. */
export function useZotzTourPhase(count: number, stepMs: number, reducedMotion: boolean): number {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (reducedMotion) {
      return
    }
    const id = window.setInterval(() => setPhase((current) => (current + 1) % count), stepMs)
    return () => window.clearInterval(id)
  }, [count, stepMs, reducedMotion])
  return reducedMotion ? count - 1 : phase
}
