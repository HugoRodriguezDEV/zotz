import type {
  ProgramStatusKind,
  ProgramStatusState
} from '../../../../../shared/program-status/protocol'
import { GLYPHS, SPRITE_INK } from './zotz-agent-sprite-art'
import { paintCells, paintGlyph } from './zotz-agent-sprite-paint'
import type { ZotzSpriteTheme } from './zotz-agent-sprite-theme'
import { CHIP, KEY, PROCESS_INK as INK, RACK } from './zotz-process-sprite-art'
import {
  CELL,
  dot,
  ink,
  jolt,
  paintCross,
  paintPadlock,
  rnd,
  stepper,
  type Frame
} from './zotz-process-sprite-frame'
import type { ZotzProcessSpec } from './zotz-process-sprite-spec'
import { paintTaskDevice } from './zotz-process-sprite-tasks'

/** Workspace with no agent: a rack whose lights blink while something there is alive. */
function paintRack(
  ctx: CanvasRenderingContext2D,
  state: 'active' | 'inactive',
  frame: Frame
): void {
  const k = stepper(frame)(180)
  const lights: Record<string, string> = {}
  for (let i = 1; i <= 6; i++) {
    const on = frame.reduced ? i % 2 === 1 : rnd(k * 7 + i) > 0.45
    lights[i] = state === 'active' && on ? INK.text : INK.off
  }
  if (state === 'inactive') {
    // One amber standby light breathes slowly.
    lights[2] =
      frame.reduced || Math.floor((frame.now + frame.seed) / 1200) % 2 ? frame.theme.amber : INK.off
  }
  paintCells(
    ctx,
    RACK,
    0,
    0,
    CELL,
    ink({ o: INK.outline, f: INK.frame, L: INK.gray, d: INK.off, ...lights })
  )
}

/** OSC 7501 program: a chip with a core light, a progress bar and its block reason. */
function paintChip(
  ctx: CanvasRenderingContext2D,
  state: ProgramStatusState,
  kind: ProgramStatusKind | undefined,
  progress: number | undefined,
  frame: Frame
): void {
  const { theme } = frame
  const step = stepper(frame)
  let core: string = INK.gray
  let x = 0
  if (state === 'working') {
    core = step(220) % 2 ? INK.live : INK.liveDim
  } else if (state === 'done') {
    core = theme.success
  } else if (state === 'blocked') {
    core = step(300) % 2 ? theme.amber : INK.amberDim
  } else if (state === 'error') {
    core = theme.danger
    x = jolt(frame)
  }
  paintCells(
    ctx,
    CHIP,
    x,
    0,
    CELL,
    ink({ o: INK.outline, c: state === 'idle' ? INK.staticDark : INK.chip, x: core })
  )
  const percent = state === 'done' ? 100 : progress
  if (percent !== undefined) {
    const filled = Math.round((percent / 100) * 6)
    for (let i = 0; i < 6; i++) {
      dot(
        ctx,
        x,
        3 + i,
        7,
        i < filled ? (state === 'done' ? theme.success : INK.live) : INK.staticDark
      )
    }
  }
  if (state === 'done') {
    paintGlyph(ctx, GLYPHS.check, 23, 13, 1, theme.success)
  } else if (state === 'error') {
    paintCross(ctx, frame, 23, 12)
  } else if (state === 'blocked') {
    if (kind === 'question') {
      ctx.fillStyle = theme.amber
      ctx.fillRect(23, 1, 8, 12)
      paintGlyph(ctx, GLYPHS.question, 24, 2, CELL, SPRITE_INK.white)
    } else if (kind === 'auth') {
      paintGlyph(ctx, KEY, 23, 4, CELL, theme.amber)
    } else {
      paintPadlock(ctx, frame)
    }
  }
}

/** One frame of a background-process device in the 32×22 row slot. */
export function paintProcessSprite(
  ctx: CanvasRenderingContext2D,
  spec: ZotzProcessSpec,
  theme: ZotzSpriteTheme,
  now: number,
  seed: number,
  reduced: boolean
): void {
  const frame: Frame = { theme, now, seed, reduced }
  switch (spec.device) {
    case 'command':
    case 'monitor':
    case 'workflow':
    case 'unknown':
      return paintTaskDevice(ctx, spec.device, spec.state, frame)
    case 'rack':
      return paintRack(ctx, spec.state, frame)
    case 'chip':
      return paintChip(ctx, spec.state, spec.kind, spec.progress, frame)
  }
}
