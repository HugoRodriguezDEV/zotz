import {
  AGENT_BODY,
  AGENT_HEAD_ROWS,
  DONE_CHECK,
  PADLOCK,
  RAISED_HAND,
  ROW_HAND,
  SPRITE_INK,
  THUMBS_UP,
  type AgentBodyColor,
  type SpriteOverlay
} from './zotz-agent-sprite-art'
import type { SpriteLook } from './zotz-agent-sprite-look'
import type { ZotzSpriteTheme } from './zotz-agent-sprite-theme'

type Paint = (cell: string) => string | null

export function paintCells(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  x: number,
  y: number,
  size: number,
  paint: Paint
): void {
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row]
    for (let col = 0; col < line.length; col++) {
      const color = paint(line[col])
      if (!color) {
        continue
      }
      ctx.fillStyle = color
      ctx.fillRect(x + col * size, y + row * size, size, size)
    }
  }
}

export function paintGlyph(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  x: number,
  y: number,
  size: number,
  color: string
): void {
  paintCells(ctx, rows, x, y, size, (cell) => (cell === '1' ? color : null))
}

function cell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  col: number,
  row: number,
  color: string,
  size: number
): void {
  ctx.fillStyle = color
  ctx.fillRect(x + col * size, y + row * size, size, size)
}

function overlayPaint(color: AgentBodyColor, theme: ZotzSpriteTheme): Paint {
  return (c) =>
    ({
      o: SPRITE_INK.outline,
      w: SPRITE_INK.glove,
      g: SPRITE_INK.gloveShade,
      b: color.body,
      s: color.shade,
      k: theme.success
    })[c] ?? null
}

function paintOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  overlay: SpriteOverlay,
  paint: Paint,
  rowShift = 0
): void {
  paintCells(
    ctx,
    overlay.rows,
    x + overlay.col * size,
    y + (overlay.row + rowShift) * size,
    size,
    paint
  )
}

function paintEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  look: SpriteLook,
  blink: boolean,
  theme: ZotzSpriteTheme
): void {
  const dot = (col: number, row: number, color: string = SPRITE_INK.eye): void =>
    cell(ctx, x, y, col, row, color, size)
  switch (look.eyes) {
    case 'happy':
      for (const eye of [4, 7]) {
        dot(eye - 1, 6)
        dot(eye, 5)
        dot(eye + 1, 6)
      }
      return
    case 'closed':
      ;[3, 4, 7, 8].forEach((col) => dot(col, 6))
      return
    case 'half':
      ;[3, 4, 7, 8].forEach((col) => dot(col, 6))
      dot(4, 5, SPRITE_INK.eyeDim)
      dot(7, 5, SPRITE_INK.eyeDim)
      return
    case 'x': {
      const color = look.xEyeColor ?? theme.danger
      for (const eye of [4, 7]) {
        dot(eye - 1, 4, color)
        dot(eye + 1, 4, color)
        dot(eye, 5, color)
        dot(eye - 1, 6, color)
        dot(eye + 1, 6, color)
      }
      return
    }
    case 'normal':
    case 'down':
    case 'up':
    case 'wide':
      break
  }
  if (blink) {
    return
  }
  const rows = { normal: [5, 6], down: [6, 7], up: [4, 5], wide: [4, 5, 6] }[look.eyes]
  for (const eye of [4, 7]) {
    const col = Math.min(8, Math.max(3, eye + look.eyeShift))
    rows.forEach((row) => dot(col, row))
  }
}

/**
 * The robot at (x, y), top-left of its 12×14-cell body. `headOnly` draws the row-size bust:
 * just the head, with the hand and padlock squeezed beside it.
 */
export function paintAgent(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  size: number,
  look: SpriteLook,
  color: AgentBodyColor,
  theme: ZotzSpriteTheme,
  now: number,
  seed: number,
  reduced: boolean,
  headOnly: boolean
): void {
  const previousAlpha = ctx.globalAlpha
  ctx.globalAlpha = previousAlpha * look.alpha
  // Props stay put while the body leans or jolts.
  if (look.padlock) {
    const lockRow = headOnly ? 5 : 8
    const lockCol = headOnly ? -3 : -5
    paintCells(
      ctx,
      PADLOCK,
      x0 + lockCol * size + look.padlockShake,
      y0 + lockRow * size,
      size,
      (c) => (c === 'o' ? SPRITE_INK.outline : c === 'y' ? SPRITE_INK.gold : null)
    )
    if (look.padlockSparks) {
      const sparks = [
        [lockCol, lockRow - 2],
        [lockCol + 3, lockRow - 2],
        [lockCol + 1, lockRow - 3],
        [lockCol + 2, lockRow - 1]
      ]
      sparks.forEach(([col, row], index) => {
        if ((Math.floor(now / 70) + index) % 2) {
          cell(ctx, x0, y0, col, row, theme.question, size)
        }
      })
    }
  }
  const x = x0 + look.offsetX * size
  const y = y0 + look.offsetY * size
  const put = (col: number, row: number, fill: string): void => {
    if (!headOnly || row < AGENT_HEAD_ROWS) {
      cell(ctx, x, y, col, row, fill, size)
    }
  }
  const handTop = -7 - look.handLift
  if (look.pose === 'raised-hand' && !headOnly) {
    // Only the short piece of arm above the head shows.
    for (let row = handTop + 7; row <= 1; row++) {
      put(0, row, SPRITE_INK.outline)
      put(1, row, color.body)
      put(2, row, color.body)
      put(3, row, SPRITE_INK.outline)
    }
  }
  const rows = headOnly ? AGENT_BODY.slice(0, AGENT_HEAD_ROWS) : AGENT_BODY
  paintCells(
    ctx,
    rows,
    x,
    y,
    size,
    (c) =>
      ({
        o: SPRITE_INK.outline,
        b: color.body,
        l: color.light,
        s: color.shade,
        v: SPRITE_INK.visor,
        a: look.tip
      })[c] ?? null
  )
  paintEyes(ctx, x, y, size, look, !reduced && (now + seed) % 3600 < 130, theme)
  if (look.antennaSparks) {
    const sparks =
      Math.floor(now / 90) % 2
        ? [
            [4, -1],
            [7, -1],
            [3, 1],
            [8, 1]
          ]
        : [
            [5, -2],
            [6, -2],
            [3, 0],
            [8, 0]
          ]
    sparks.forEach(([col, row], index) =>
      cell(ctx, x, y, col, row, index % 2 ? theme.amber : theme.danger, size)
    )
  }
  const paint = overlayPaint(color, theme)
  let leftArmDrawn = false
  let rightArmDrawn = false
  if (look.pose === 'raised-hand') {
    if (headOnly) {
      paintOverlay(ctx, x, y, size, ROW_HAND, paint, look.wave ? -1 : 0)
    } else {
      paintCells(ctx, RAISED_HAND, x - 2 * size, y + handTop * size, size, paint)
    }
    leftArmDrawn = true
  } else if (look.pose === 'reach') {
    const hand = 1 - look.reach
    for (let col = 2; col > hand; col--) {
      put(col, 10, color.shade)
    }
    put(hand, 10, color.light)
    leftArmDrawn = true
  } else if (look.pose === 'thumbs-up' && !headOnly) {
    paintOverlay(ctx, x, y, size, THUMBS_UP, paint, look.thumbDrop)
    if (look.checkVisible) {
      paintOverlay(ctx, x, y, size, DONE_CHECK, paint, look.checkLift)
    }
    rightArmDrawn = true
  }
  if (!headOnly && look.laptop) {
    const tap = reduced ? 0 : Math.floor(now / 140) % 2
    put(2, 10 + tap, color.shade)
    put(9, 11 - tap, color.shade)
    for (let col = 3; col <= 8; col++) {
      put(col, 11, SPRITE_INK.laptop)
    }
    for (let col = 2; col <= 9; col++) {
      put(col, 12, SPRITE_INK.keyboard)
    }
    if (reduced || Math.floor(now / 450) % 2) {
      put(4 + (Math.floor(now / 900) % 3), 11, theme.live)
    }
    leftArmDrawn = rightArmDrawn = true
  }
  if (!leftArmDrawn) {
    put(2, 10, color.shade)
    put(2, 11, color.shade)
  }
  if (!rightArmDrawn) {
    put(9, 10, color.shade)
    put(9, 11, color.shade)
  }
  ctx.globalAlpha = previousAlpha
}
