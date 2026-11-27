import type React from 'react'
import { useEffect, useRef } from 'react'
import { useComposedRefs } from 'radix-ui/internal'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { subscribeZotzSpriteClock } from './zotz-agent-sprite-clock'
import { ROW_SPRITE_HEIGHT, ROW_SPRITE_WIDTH } from './zotz-agent-sprite-row'
import {
  subscribeZotzSpriteTheme,
  zotzSpriteTheme,
  type ZotzSpriteTheme
} from './zotz-agent-sprite-theme'

export type ZotzRowSpritePaint = (
  ctx: CanvasRenderingContext2D,
  theme: ZotzSpriteTheme,
  now: number,
  reduced: boolean
) => void

/**
 * Drives a row-size pixel canvas: sharp at any DPI, repainted on theme switch, animated by the
 * shared clock only while on screen, and still under reduced motion. Returns the canvas ref to set,
 * which also forwards to `ref` so tooltip triggers can anchor on the canvas.
 */
export function useZotzRowSpriteCanvas(
  ref: React.Ref<HTMLCanvasElement> | undefined,
  paint: ZotzRowSpritePaint
): (node: HTMLCanvasElement | null) => void {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
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
    const draw = (now: number): void => {
      ctx.clearRect(0, 0, ROW_SPRITE_WIDTH, ROW_SPRITE_HEIGHT)
      paint(ctx, zotzSpriteTheme(), now, reduced)
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
  }, [paint, reduced])

  return useComposedRefs(ref, canvasRef)
}
