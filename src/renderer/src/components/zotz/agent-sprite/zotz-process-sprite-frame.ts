// Shared drawing pieces for the background-process devices (see zotz-process-sprite-paint.ts).
import { PADLOCK, SPRITE_INK } from './zotz-agent-sprite-art'
import { paintCell, paintCells, paintGlyph } from './zotz-agent-sprite-paint'
import type { ZotzSpriteTheme } from './zotz-agent-sprite-theme'
import { CROSS, PROCESS_INK as INK } from './zotz-process-sprite-art'

export const CELL = 2

export type Frame = { theme: ZotzSpriteTheme; now: number; seed: number; reduced: boolean }

export const ink =
  (map: Record<string, string>) =>
  (c: string): string | null =>
    map[c] ?? null

export function stepper({ now, seed, reduced }: Frame): (ms: number) => number {
  return (ms) => (reduced ? 0 : Math.floor((now + seed) / ms))
}

/** Same pseudo-random sequence on every run, so static and blinking lights never flicker between renders. */
export function rnd(n: number): number {
  const v = Math.sin(n * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

/** A short shake every 1.5 s for faults. */
export function jolt({ now, seed, reduced }: Frame): number {
  if (reduced || (now + seed) % 1500 >= 300) {
    return 0
  }
  return Math.floor(now / 45) % 2 ? 1 : -1
}

export function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  col: number,
  row: number,
  color: string
): void {
  paintCell(ctx, x, 0, col, row, color, CELL)
}

/** "No signal" static over the cells `inside` accepts. */
export function paintStatic(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  x: number,
  cols: [number, number],
  rows: [number, number],
  inside: (col: number, row: number) => boolean = () => true
): void {
  const k = frame.reduced ? 0 : Math.floor(frame.now / 90)
  for (let row = rows[0]; row <= rows[1]; row++) {
    for (let col = cols[0]; col <= cols[1]; col++) {
      if (inside(col, row) && rnd(k * 131 + row * 17 + col) > 0.55) {
        dot(ctx, x, col, row, rnd(k + row + col * 7) > 0.5 ? INK.static : INK.staticDark)
      }
    }
  }
}

export function paintPadlock(ctx: CanvasRenderingContext2D, frame: Frame): void {
  if (frame.reduced || Math.floor(frame.now / 400) % 2 === 0) {
    paintCells(ctx, PADLOCK, 23, 11, CELL, ink({ o: SPRITE_INK.outline, y: frame.theme.amber }))
  }
}

export function paintPause(ctx: CanvasRenderingContext2D, theme: ZotzSpriteTheme): void {
  ctx.fillStyle = theme.muted
  ctx.fillRect(24, 2, 2, 8)
  ctx.fillRect(28, 2, 2, 8)
}

export function paintCross(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  x: number,
  y: number
): void {
  if (frame.reduced || Math.floor(frame.now / 300) % 2 === 0) {
    paintGlyph(ctx, CROSS, x, y, CELL, frame.theme.danger)
  }
}
