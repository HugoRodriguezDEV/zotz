import React, { useCallback, useMemo } from 'react'
import { cn } from '@/lib/class-names'
import { agentAnimationSeed } from './zotz-agent-sprite-art'
import { ROW_SPRITE_HEIGHT, ROW_SPRITE_WIDTH } from './zotz-agent-sprite-row'
import { paintProcessSprite } from './zotz-process-sprite-paint'
import type { ZotzProcessSpec } from './zotz-process-sprite-spec'
import { useZotzRowSpriteCanvas, type ZotzRowSpritePaint } from './use-zotz-row-sprite-canvas'

type Props = Omit<React.ComponentProps<'canvas'>, 'children'> & {
  sprite: ZotzProcessSpec
  /** Accessible name: the state label, plus any detail the caller adds. */
  label: string
  /** Stable key of the task or workspace, so neighbors don't blink in lockstep. */
  identity?: string
}

/** Background work that is not an agent, as a small pixel device in the robot's row slot. */
export function ZotzProcessSprite({
  sprite,
  label,
  identity,
  className,
  style,
  ref,
  ...rest
}: Props): React.JSX.Element {
  // Callers build the spec inline; restart the canvas only when what it draws changes.
  const key = JSON.stringify(sprite)
  const spec = useMemo((): ZotzProcessSpec => JSON.parse(key), [key])
  const paint = useCallback<ZotzRowSpritePaint>(
    (ctx, theme, now, reduced) =>
      paintProcessSprite(
        ctx,
        spec,
        theme,
        now,
        agentAnimationSeed(identity ?? spec.identity),
        reduced
      ),
    [spec, identity]
  )
  const setCanvas = useZotzRowSpriteCanvas(ref, paint)

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
