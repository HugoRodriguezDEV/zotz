// Chat background tasks that are not agents: command, monitor, workflow and unknown.
import type { AgentChildDisplayState } from '../../../../../shared/agent-status/child-work/agent-status-child-work-display'
import { GLYPHS } from './zotz-agent-sprite-art'
import { paintCells, paintGlyph } from './zotz-agent-sprite-paint'
import { CLIPBOARD, GEAR_FRAMES, PROCESS_INK as INK, TERMINAL } from './zotz-process-sprite-art'
import {
  CELL,
  dot,
  ink,
  jolt,
  paintCross,
  paintPadlock,
  paintPause,
  paintStatic,
  rnd,
  stepper,
  type Frame
} from './zotz-process-sprite-frame'
import type { ZotzTaskDevice } from './zotz-process-sprite-spec'

type TaskState = AgentChildDisplayState

/** Failed and blocked look alike. */
function shownState(state: TaskState): Exclude<TaskState, 'failed'> {
  return state === 'failed' ? 'blocked' : state
}

/** Devices without a watching look show a monitoring task as running. */
function runningState(state: TaskState): Exclude<TaskState, 'failed' | 'monitoring'> {
  const shown = shownState(state)
  return shown === 'monitoring' ? 'working' : shown
}

/** Command: a terminal whose screen tells the state. */
function paintTerminal(ctx: CanvasRenderingContext2D, raw: TaskState, frame: Frame): void {
  const state = runningState(raw)
  const { theme } = frame
  if (state === 'interrupted') {
    paintCells(
      ctx,
      TERMINAL,
      0,
      0,
      CELL,
      ink({ o: INK.outline, f: INK.frame, s: INK.off, l: INK.frameDim })
    )
    for (let col = 2; col <= 5; col++) {
      dot(ctx, 0, col, 2, INK.gray)
    }
    paintPause(ctx, theme)
    return
  }
  const step = stepper(frame)
  let screen: string = INK.screen
  let led: string = INK.text
  let x = 0
  if (state === 'blocked') {
    screen = INK.screenFault
    led = step(150) % 2 ? theme.danger : INK.frameDim
    x = jolt(frame)
  } else if (state === 'idle') {
    screen = INK.off
    led = INK.frameDim
  } else if (state === 'unverifiable') {
    screen = INK.off
    led = step(600) % 2 ? theme.amber : INK.frameDim
  } else if (state === 'waiting') {
    led = theme.amber
  } else if (state === 'working') {
    led = step(200) % 2 ? INK.text : INK.frameDim
  }
  paintCells(ctx, TERMINAL, x, 0, CELL, ink({ o: INK.outline, f: INK.frame, s: screen, l: led }))
  const line = (row: number, length: number, color: string): void => {
    for (let col = 0; col < length; col++) {
      dot(ctx, x, 2 + col, row, color)
    }
  }
  switch (state) {
    case 'working': {
      const k = step(260)
      line(2, 2 + Math.floor(rnd(k) * 6), INK.text)
      line(4, 2 + Math.floor(rnd(k + 1) * 6), INK.text)
      line(6, 1, INK.text)
      if (step(220) % 2 === 0) {
        dot(ctx, x, 4, 6, INK.cursor)
      }
      return
    }
    case 'waiting':
      line(2, 6, INK.text)
      line(6, 1, INK.text)
      if (step(260) % 2 === 0) {
        dot(ctx, x, 4, 5, theme.amber)
        dot(ctx, x, 4, 6, theme.amber)
      }
      paintPadlock(ctx, frame)
      return
    case 'done':
      line(2, 4, INK.text)
      line(4, 3, INK.text)
      paintGlyph(ctx, GLYPHS.check, x + 12, 9, 1, INK.text)
      return
    case 'blocked':
      paintCross(ctx, frame, x + 8, 5)
      return
    case 'idle':
      for (let row = 4; row <= 5; row++) {
        for (let col = 5; col <= 6; col++) {
          dot(ctx, x, col, row, INK.gray)
        }
      }
      return
    case 'unverifiable':
      paintStatic(ctx, frame, x, [2, 9], [2, 6])
  }
}

/** Monitor: a radar whose sweep turns while it watches. */
function paintRadar(ctx: CanvasRenderingContext2D, raw: TaskState, frame: Frame): void {
  const state = shownState(raw)
  const { theme } = frame
  if (state === 'interrupted') {
    paintRadar(ctx, 'idle', frame)
    paintPause(ctx, theme)
    return
  }
  const cx = 5.5
  const cy = 5
  const radius = 5.2
  const inDisc = (col: number, row: number): boolean =>
    Math.hypot(col - cx, row - cy) <= radius - 1.1
  const rim = state === 'blocked' ? theme.danger : state === 'idle' ? INK.frameDim : INK.frame
  const face =
    state === 'blocked'
      ? INK.screenFault
      : state === 'idle' || state === 'unverifiable'
        ? INK.off
        : INK.screen
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 12; col++) {
      const distance = Math.hypot(col - cx, row - cy)
      if (distance <= radius + 0.4) {
        dot(ctx, 0, col, row, distance > radius - 1.1 ? rim : face)
      }
    }
  }
  const sweeping =
    state === 'monitoring' || state === 'working' || state === 'waiting' || state === 'idle'
  if (sweeping) {
    // A stopped radar keeps its sweep frozen.
    const still = frame.reduced || state === 'idle'
    const angle = still ? -0.6 : ((frame.now + frame.seed) / 900) * Math.PI * 2
    const sweep = state === 'idle' ? INK.gray : INK.text
    for (let t = 1; t <= 4; t++) {
      dot(
        ctx,
        0,
        Math.round(cx + Math.cos(angle) * t * 0.95),
        Math.round(cy + Math.sin(angle) * t * 0.95),
        sweep
      )
    }
    if (state !== 'idle') {
      // The blip lights up as the sweep passes it.
      dot(ctx, 0, 8, 3, Math.cos(angle + 0.9) > 0.6 ? INK.blip : INK.blipDim)
    }
  }
  if (state === 'waiting') {
    paintPadlock(ctx, frame)
  } else if (state === 'done') {
    paintGlyph(ctx, GLYPHS.check, 6, 6, CELL, INK.text)
  } else if (state === 'blocked') {
    paintCross(ctx, frame, 7, 6)
  } else if (state === 'unverifiable') {
    paintStatic(ctx, frame, 0, [1, 10], [1, 9], inDisc)
  }
}

/** Workflow: a clipboard whose steps get checked off. */
function paintClipboard(ctx: CanvasRenderingContext2D, raw: TaskState, frame: Frame): void {
  const state = runningState(raw)
  const { theme } = frame
  if (state === 'interrupted') {
    paintClipboard(ctx, 'idle', frame)
    paintPause(ctx, theme)
    return
  }
  const step = stepper(frame)
  let boxes: string[]
  if (state === 'working') {
    const current = step(900) % 3
    const blink = step(250) % 2 ? INK.live : INK.liveDim
    boxes = [0, 1, 2].map((i) => (i < current ? INK.step : i === current ? blink : INK.gray))
  } else if (state === 'waiting') {
    boxes = [INK.step, step(300) % 2 ? theme.amber : INK.amberDim, INK.gray]
  } else if (state === 'done') {
    boxes = [INK.step, INK.step, INK.step]
  } else if (state === 'blocked') {
    boxes = [INK.step, theme.danger, INK.gray]
  } else {
    boxes = [INK.gray, INK.gray, INK.gray]
  }
  const paper = state === 'idle' || state === 'unverifiable' ? INK.paperDim : INK.paper
  paintCells(
    ctx,
    CLIPBOARD,
    0,
    0,
    CELL,
    ink({
      o: INK.outline,
      f: INK.frame,
      p: paper,
      L: INK.line,
      1: boxes[0],
      2: boxes[1],
      3: boxes[2]
    })
  )
  if (state === 'waiting') {
    paintPadlock(ctx, frame)
  } else if (state === 'done') {
    paintGlyph(ctx, GLYPHS.check, 23, 13, 1, theme.success)
  } else if (state === 'unverifiable') {
    paintStatic(ctx, frame, 0, [2, 9], [2, 8])
  }
}

/** Unknown task: a gear that turns while it runs. */
function paintGear(ctx: CanvasRenderingContext2D, raw: TaskState, frame: Frame): void {
  const state = shownState(raw)
  const { theme } = frame
  if (state === 'interrupted') {
    paintGear(ctx, 'idle', frame)
    paintPause(ctx, theme)
    return
  }
  const turning = (state === 'working' || state === 'monitoring') && !frame.reduced
  const gear = GEAR_FRAMES[turning && Math.floor((frame.now + frame.seed) / 200) % 2 ? 1 : 0]
  const color = {
    working: INK.live,
    monitoring: INK.live,
    waiting: theme.amber,
    done: theme.success,
    blocked: theme.danger,
    idle: INK.gray,
    unverifiable: INK.grayDim
  }[state]
  const x = state === 'blocked' ? jolt(frame) : 0
  paintCells(ctx, gear, x, 0, CELL, (c) => (c === 'k' ? color : null))
  if (state === 'waiting') {
    paintPadlock(ctx, frame)
  }
}

/** One frame of a background task's device. */
export function paintTaskDevice(
  ctx: CanvasRenderingContext2D,
  device: ZotzTaskDevice,
  state: TaskState,
  frame: Frame
): void {
  switch (device) {
    case 'command':
      return paintTerminal(ctx, state, frame)
    case 'monitor':
      return paintRadar(ctx, state, frame)
    case 'workflow':
      return paintClipboard(ctx, state, frame)
    case 'unknown':
      return paintGear(ctx, state, frame)
  }
}
