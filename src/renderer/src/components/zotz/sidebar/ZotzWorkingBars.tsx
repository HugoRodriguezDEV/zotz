import { useEffect, useRef } from 'react'
import { agentStateLabel } from '@/components/AgentStateDot'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/class-names'

const BAR_DELAYS_MS = [0, 150, 300]
// Uneven resting heights so the reduced-motion mark still reads as "working", not as a pause icon.
const RESTING_SCALES = [0.55, 1, 0.75]

// Web Animations, not CSS keyframes: no new global keyframes and the animation stops with the node.
function animateBars(bars: HTMLSpanElement[]): () => void {
  const animations = bars.map((bar, index) =>
    bar.animate(
      [{ transform: 'scaleY(0.35)' }, { transform: 'scaleY(1)' }, { transform: 'scaleY(0.35)' }],
      { duration: 1100, delay: BAR_DELAYS_MS[index], iterations: Infinity, easing: 'ease-in-out' }
    )
  )
  return () => animations.forEach((animation) => animation.cancel())
}

/** Working agent: three bars rising and falling, like a level meter; the same mark the site uses. */
export function ZotzWorkingBars({ className }: { className?: string }): React.JSX.Element {
  const reducedMotion = usePrefersReducedMotion()
  const barsRef = useRef<HTMLSpanElement[]>([])

  useEffect(() => {
    const bars = barsRef.current.filter(Boolean)
    return bars.length > 0 && !reducedMotion ? animateBars(bars) : undefined
  }, [reducedMotion])

  return (
    <span
      role="img"
      aria-label={agentStateLabel('working')}
      className={cn(
        'inline-flex h-2.5 shrink-0 items-center gap-0.5 text-zotz-working-wave',
        className
      )}
    >
      {RESTING_SCALES.map((scale, index) => (
        <span
          key={index}
          ref={(node) => {
            if (node) {
              barsRef.current[index] = node
            }
          }}
          className="h-full w-0.5 rounded-full bg-current"
          style={{ transform: `scaleY(${reducedMotion ? scale : 0.35})` }}
        />
      ))}
    </span>
  )
}
