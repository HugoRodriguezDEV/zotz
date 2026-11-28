import React, { useCallback } from 'react'
import { cn } from '@/lib/class-names'
import { agentAnimationSeed, agentBodyColorFor } from './zotz-agent-sprite-art'
import { zotzSpriteLook, type ZotzSpriteState } from './zotz-agent-sprite-look'
import { paintRowSprite, ROW_SPRITE_HEIGHT, ROW_SPRITE_WIDTH } from './zotz-agent-sprite-row'
import { useZotzRowSpriteCanvas, type ZotzRowSpritePaint } from './use-zotz-row-sprite-canvas'

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
  const paint = useCallback<ZotzRowSpritePaint>(
    (ctx, theme, now, reduced) => {
      const color = agentBodyColorFor(identity, agentType)
      const seed = agentAnimationSeed(identity)
      paintRowSprite(
        ctx,
        zotzSpriteLook(state, now, seed, reduced, color, theme),
        color,
        theme,
        now,
        seed,
        reduced
      )
    },
    [state, identity, agentType]
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
