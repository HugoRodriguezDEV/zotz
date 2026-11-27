import { GLYPHS, SPRITE_INK, WARNING_SIGN, type AgentBodyColor } from './zotz-agent-sprite-art'
import type { SpriteLook } from './zotz-agent-sprite-look'
import { paintAgent, paintCells, paintGlyph } from './zotz-agent-sprite-paint'
import type { ZotzSpriteTheme } from './zotz-agent-sprite-theme'

/** Row-size sprite in CSS pixels: head on the right of a small strip that holds a hand or padlock. */
export const ROW_SPRITE_WIDTH = 32
export const ROW_SPRITE_HEIGHT = 22

/** The row-size bust plus its state badge in the top-right corner. */
export function paintRowSprite(
  ctx: CanvasRenderingContext2D,
  look: SpriteLook,
  color: AgentBodyColor,
  theme: ZotzSpriteTheme,
  now: number,
  seed: number,
  reduced: boolean
): void {
  ctx.clearRect(0, 0, ROW_SPRITE_WIDTH, ROW_SPRITE_HEIGHT)
  paintAgent(ctx, 6, 2, 2, look, color, theme, now, seed, reduced, true)
  const left = 23
  const chip = (width: number, height: number, fill: string): void => {
    ctx.fillStyle = fill
    ctx.fillRect(left, 1, width, height)
  }
  const white = SPRITE_INK.white
  switch (look.badge) {
    case 'working': {
      // The Zotz working wave: three bars rising and falling.
      ctx.fillStyle = theme.live
      ;[0, 1, 2].forEach((bar) => {
        const height = reduced
          ? [5, 9, 7][bar]
          : 3 + Math.round(3 * (1 + Math.sin(now / 180 - bar * 0.9)))
        ctx.fillRect(left + bar * 3, 10 - height, 2, height)
      })
      break
    }
    case 'question':
      chip(8, 12, theme.question)
      paintGlyph(ctx, GLYPHS.question, left + 1, 2, 2, white)
      break
    case 'exclamation':
      chip(8, 12, theme.question)
      paintGlyph(ctx, GLYPHS.exclamation, left + 2, 2, 2, white)
      break
    case 'check':
      chip(8, 8, theme.success)
      paintGlyph(ctx, GLYPHS.check, left + 1, 2, 1, white)
      break
    case 'unread':
      ctx.fillStyle = theme.unread
      ctx.fillRect(left, 2, 7, 5)
      ctx.fillRect(left + 1, 1, 5, 7)
      break
    case 'stop':
      chip(8, 8, theme.danger)
      ctx.fillStyle = white
      ctx.fillRect(left + 2, 4, 4, 2)
      break
    case 'pause':
      ctx.fillStyle = theme.muted
      ctx.fillRect(left + 1, 1, 2, 7)
      ctx.fillRect(left + 5, 1, 2, 7)
      break
    case 'sleep': {
      const rise = reduced ? 0 : Math.floor(now / 350) % 3
      paintGlyph(ctx, GLYPHS.sleep, left + 2, 3 - rise, 2, theme.muted)
      break
    }
    case 'warning':
      if (look.warningOn) {
        paintCells(ctx, WARNING_SIGN, left - 1, 1, 1, (c) =>
          c === 'r' ? theme.danger : c === 'w' ? white : null
        )
      }
      break
    case 'hourglass':
      chip(8, 8, theme.pending)
      paintGlyph(ctx, GLYPHS.hourglass, left + 1, 2, 1, white)
      break
    case 'ban':
      paintGlyph(ctx, GLYPHS.ban, left + 1, 1, 1, theme.muted)
      break
    case null:
      break
  }
}
