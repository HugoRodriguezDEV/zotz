// One shared animation clock for every pixel agent on screen. Pixel art reads best at a low frame
// rate, and a single requestAnimationFrame loop keeps long lists cheap; it pauses on its own while
// the window is hidden.

const FRAME_MS = 80

type Tick = (now: number) => void

const ticks = new Set<Tick>()
let frame = 0
let lastTick = 0

function loop(now: number): void {
  frame = requestAnimationFrame(loop)
  if (now - lastTick < FRAME_MS) {
    return
  }
  lastTick = now
  ticks.forEach((tick) => tick(now))
}

export function subscribeZotzSpriteClock(tick: Tick): () => void {
  ticks.add(tick)
  if (ticks.size === 1) {
    frame = requestAnimationFrame(loop)
  }
  return () => {
    ticks.delete(tick)
    if (ticks.size === 0) {
      cancelAnimationFrame(frame)
    }
  }
}
