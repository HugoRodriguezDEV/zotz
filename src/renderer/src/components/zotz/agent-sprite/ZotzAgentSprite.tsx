import React, { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/class-names'
import { agentAnimationSeed, agentBodyColorFor } from './zotz-agent-sprite-art'
import { subscribeZotzSpriteClock } from './zotz-agent-sprite-clock'
import { zotzSpriteLook, type ZotzSpriteState } from './zotz-agent-sprite-look'
import { paintRowSprite, ROW_SPRITE_HEIGHT, ROW_SPRITE_WIDTH } from './zotz-agent-sprite-row'
import { subscribeZotzSpriteTheme, zotzSpriteTheme } from './zotz-agent-sprite-theme'

type Props = Omit<React.ComponentProps<'canvas'>, 'children'> & {
  state: ZotzSpriteState
  /** Accessible name: the state label, plus any detail the caller adds. */
  label: string
  /** Stable key of the conversation or agent, so it keeps its robot color everywhere. */
  identity?: string
  /** The agent running in that chat; its model picks the robot's color. */
  agentType?: string | null
}

/** A conversation's state as a small pixel robot: its face, pose and badge change with the state. */
export function ZotzAgentSprite({
  state,
  label,
  identity,
  agentType,
  className,
  style,
  ref,
  ...rest
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Tooltip triggers pass their own ref to anchor the tooltip; keep it alongside ours.
  const setCanvas = (node: HTMLCanvasElement | null): void => {
    canvasRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return undefined
    }
    const scale = window.devicePixelRatio || 1
    canvas.width = ROW_SPRITE_WIDTH * scale
    canvas.height = ROW_SPRITE_HEIGHT * scale
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const color = agentBodyColorFor(identity, agentType)
    const seed = agentAnimationSeed(identity)
    const draw = (now: number): void => {
      const theme = zotzSpriteTheme()
      paintRowSprite(
        ctx,
        zotzSpriteLook(state, now, seed, reduced, color, theme),
        color,
        theme,
        now,
        seed,
        reduced
      )
    }
    draw(performance.now())
    const stopTheme = subscribeZotzSpriteTheme(() => draw(performance.now()))
    if (reduced) {
      return stopTheme
    }
    // Animate only while on screen; long lists keep most rows still.
    let stopClock: (() => void) | null = null
    const visibility = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        if (!stopClock) {
          stopClock = subscribeZotzSpriteClock(draw)
        }
      } else {
        stopClock?.()
        stopClock = null
      }
    })
    visibility.observe(canvas)
    return () => {
      visibility.disconnect()
      stopClock?.()
      stopTheme()
    }
  }, [state, identity, agentType, reduced])

  return (
    <canvas
      {...rest}
      ref={setCanvas}
      role="img"
      aria-label={label}
      className={cn('block shrink-0', className)}
      style={{ width: ROW_SPRITE_WIDTH, height: ROW_SPRITE_HEIGHT, ...style }}
    />
  )
}
