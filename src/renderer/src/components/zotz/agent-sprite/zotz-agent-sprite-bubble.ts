import { ENVELOPE, GLYPHS, SPRITE_INK, WARNING_SIGN } from './zotz-agent-sprite-art'
import type { SpriteBubble, SpriteLook } from './zotz-agent-sprite-look'
import { paintCells, paintGlyph } from './zotz-agent-sprite-paint'
import type { ZotzSpriteTheme } from './zotz-agent-sprite-theme'

const BUBBLE_WIDTH: Record<SpriteBubble | 'mail', number> = {
  dots: 30,
  mail: 22,
  question: 16,
  exclamation: 14,
  sleep: 16,
  stop: 16,
  warning: 24
}

/** Speech bubble centered on `centerX` above `top`, for the full-body robot on the group map. */
export function paintSpriteBubble(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  top: number,
  kind: SpriteBubble | 'mail',
  look: SpriteLook,
  theme: ZotzSpriteTheme,
  now: number,
  reduced: boolean
): void {
  const width = BUBBLE_WIDTH[kind]
  const height = kind === 'warning' ? 20 : 16
  const cx = Math.round(centerX)
  const x = Math.round(cx - width / 2)
  const rise = kind === 'sleep' && !reduced ? Math.floor(now / 400) % 3 : 0
  const y = Math.round(top - height - 6) - rise
  ctx.fillStyle = kind === 'warning' && look.warningOn ? theme.danger : theme.bubbleLine
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2)
  ctx.fillStyle = theme.bubble
  ctx.fillRect(x, y, width, height)
  ctx.fillStyle = theme.bubbleLine
  ctx.fillRect(cx - 2, y + height + 1, 4, 2)
  ctx.fillRect(cx - 1, y + height + 3, 2, 2)
  ctx.fillStyle = theme.bubble
  ctx.fillRect(cx - 1, y + height - 1, 2, 3)
  switch (kind) {
    case 'dots': {
      const shown = reduced ? 3 : Math.floor(now / 280) % 4
      for (let index = 0; index < 3; index++) {
        ctx.fillStyle = index < shown ? theme.foreground : theme.bubbleLine
        ctx.fillRect(x + 6 + index * 7, y + 7, 3, 3)
      }
      return
    }
    case 'mail':
      paintCells(ctx, ENVELOPE, x + 4, y + 3, 2, (c) =>
        c === 'o'
          ? SPRITE_INK.outline
          : c === 'w'
            ? SPRITE_INK.paper
            : c === 'r'
              ? theme.live
              : null
      )
      return
    case 'stop':
      ctx.fillStyle = theme.danger
      ctx.fillRect(x + 3, y + 3, 10, 10)
      ctx.fillStyle = SPRITE_INK.white
      ctx.fillRect(x + 5, y + 7, 6, 2)
      return
    case 'warning':
      if (look.warningOn) {
        paintCells(ctx, WARNING_SIGN, x + 3, y + 2, 2, (c) =>
          c === 'r' ? theme.danger : c === 'w' ? SPRITE_INK.white : null
        )
      }
      return
    case 'question':
    case 'exclamation':
    case 'sleep': {
      const glyph = GLYPHS[kind]
      paintGlyph(
        ctx,
        glyph,
        cx - glyph[0].length,
        y + 3,
        2,
        kind === 'sleep' ? theme.muted : theme.question
      )
    }
  }
}
