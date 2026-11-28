// Where the robots stand in the room: default spots, bounds and keeping name tags apart.
// Positions are fractions of the room so they survive a resized panel.

/** Full-body robot at scale 3: 12×14 cells. */
export const ZOTZ_ROOM_SPRITE_SCALE = 3
export const ZOTZ_ROOM_SPRITE_W = 12 * ZOTZ_ROOM_SPRITE_SCALE
export const ZOTZ_ROOM_SPRITE_H = 14 * ZOTZ_ROOM_SPRITE_SCALE

export type ZotzRoomSpot = { fx: number; fy: number }

/** Box (around the feet) that grabs a robot, its bubble and its tag. */
export const ZOTZ_ROOM_HIT = { halfWidth: 28, above: ZOTZ_ROOM_SPRITE_H + 10, below: 26 }

/** The robot under a point; the one in front wins. */
export function hitZotzRoomAgent(
  agents: readonly { key: string; at: { x: number; y: number } }[],
  x: number,
  y: number
): string | null {
  const front = [...agents].sort((a, b) => b.at.y - a.at.y)
  return (
    front.find(
      ({ at }) =>
        Math.abs(x - at.x) <= ZOTZ_ROOM_HIT.halfWidth &&
        y >= at.y - ZOTZ_ROOM_HIT.above &&
        y <= at.y + ZOTZ_ROOM_HIT.below
    )?.key ?? null
  )
}

/**
 * What a robot paints around its feet, in pixels: above them the head, the raised hand and the
 * tallest bubble (a hop adds a moment more); beside it the laptop, padlock or thumb; below them
 * the name tag. Robots keep all of it apart.
 */
const ABOVE_FEET = 70
const BODY_HALF_WIDTH = 32
const TAG_TOP = 7
const TAG_BOTTOM = 24
const GAP = 6

// Feet of the top row leave room for the head and its bubble; rows clear the bubble, robot and tag.
const TOP = ABOVE_FEET + 10
const ROW = ABOVE_FEET + TAG_BOTTOM + GAP + 2
const BOTTOM = 52

/** Robots per row: two in a narrow panel, more when it is wide. Up to three make their own shape. */
export function zotzRoomColumns(count: number, width: number): number {
  return count <= 3 ? 2 : Math.min(count, Math.max(2, Math.floor(width / 130)))
}

function rowsFor(count: number, columns: number): number {
  return count <= 2 ? 1 : count === 3 ? 2 : Math.ceil(count / columns)
}

export function zotzRoomHeight(count: number, columns: number): number {
  return Math.max(200, TOP + (rowsFor(count, columns) - 1) * ROW + BOTTOM)
}

/** Feet bounds in pixels; keeps the head, bubble and name tag inside the room. */
export function zotzRoomBounds(
  width: number,
  height: number
): { x0: number; x1: number; y0: number; y1: number } {
  const y0 = ABOVE_FEET + 4
  return { x0: 44, x1: Math.max(44, width - 44), y0, y1: Math.max(y0, height - 28) }
}

/** Rows of `columns`, a short last row centered. Two stand side by side; three make a triangle. */
export function zotzDefaultRoomSpot(index: number, count: number, columns: number): ZotzRoomSpot {
  const height = zotzRoomHeight(count, columns)
  if (count <= 2) {
    return { fx: count === 1 ? 0.5 : index === 0 ? 0.27 : 0.73, fy: 0.62 }
  }
  if (count === 3) {
    return index === 0
      ? { fx: 0.5, fy: TOP / height }
      : { fx: index === 1 ? 0.25 : 0.75, fy: (TOP + ROW) / height }
  }
  const row = Math.floor(index / columns)
  const inRow = Math.min(columns, count - row * columns)
  const column = (index % columns) + (columns - inRow) / 2
  return { fx: 0.04 + (0.92 * (column + 0.5)) / columns, fy: (TOP + row * ROW) / height }
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value))

/** Pulls a spot back inside the stage. */
export function clampZotzRoomSpot(spot: ZotzRoomSpot, width: number, height: number): ZotzRoomSpot {
  const bounds = zotzRoomBounds(width, height)
  return {
    fx: clamp(spot.fx * width, bounds.x0, bounds.x1) / width,
    fy: clamp(spot.fy * height, bounds.y0, bounds.y1) / height
  }
}

type Box = { left: number; right: number; top: number; bottom: number }

/** The robot with its bubble and raised hand, then its name tag. */
function boxesAt(x: number, y: number, tagWidth: number): [Box, Box] {
  return [
    { left: x - BODY_HALF_WIDTH, right: x + BODY_HALF_WIDTH, top: y - ABOVE_FEET, bottom: y },
    { left: x - tagWidth / 2, right: x + tagWidth / 2, top: y + TAG_TOP, bottom: y + TAG_BOTTOM }
  ]
}

/**
 * How far `b`'s robot must move (along x or y, whichever is shorter) so none of its boxes touches
 * `a`'s; 0 when they are already apart. `sx`/`sy` say which way `b` lies from `a`.
 */
function pushBetween(
  a: readonly Box[],
  b: readonly Box[],
  sx: number,
  sy: number,
  sideways: boolean
): { alongX: boolean; push: number } {
  let best = { alongX: true, push: 0 }
  for (const p of a) {
    for (const q of b) {
      const apart =
        Math.min(p.right, q.right) - Math.max(p.left, q.left) + GAP <= 0 ||
        Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) + GAP <= 0
      if (apart) {
        continue
      }
      const needX = (sx > 0 ? p.right - q.left : q.right - p.left) + GAP
      const needY = (sy > 0 ? p.bottom - q.top : q.bottom - p.top) + GAP
      // Slide along the axis that needs the shorter push; ties go sideways.
      const pair =
        sideways || needX <= needY ? { alongX: true, push: needX } : { alongX: false, push: needY }
      if (pair.push > best.push) {
        best = pair
      }
    }
  }
  return best
}

/**
 * One step of pushing apart robots whose bubble, body or name tag would touch another's; `pinned`
 * (the one being moved) stays put. `sideways` pushes along x only, for a column too tall for the
 * room. Mutates `spots` and returns the largest move in pixels, so callers know when it settled.
 */
export function separateZotzRoomSpots(
  spots: ZotzRoomSpot[],
  tagWidths: readonly number[],
  pinned: number | null,
  width: number,
  height: number,
  sideways = false,
  strength = 0.25
): number {
  let moved = 0
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const xi = spots[i].fx * width
      const yi = spots[i].fy * height
      const xj = spots[j].fx * width
      const yj = spots[j].fy * height
      // Exactly stacked: i goes one way, j the other.
      const sx = Math.sign(xj - xi) || 1
      const sy = Math.sign(yj - yi) || 1
      const { alongX, push: need } = pushBetween(
        boxesAt(xi, yi, tagWidths[i]),
        boxesAt(xj, yj, tagWidths[j]),
        sx,
        sy,
        sideways
      )
      if (need <= 0) {
        continue
      }
      const moveI = pinned !== i
      const moveJ = pinned !== j
      const share = moveI && moveJ ? 0.5 : 1
      const push = need * strength * share
      const step = (alongX ? sx : sy) * push
      if (alongX) {
        if (moveI) {
          spots[i].fx -= step / width
        }
        if (moveJ) {
          spots[j].fx += step / width
        }
      } else {
        if (moveI) {
          spots[i].fy -= step / height
        }
        if (moveJ) {
          spots[j].fy += step / height
        }
      }
      moved = Math.max(moved, push)
    }
  }
  for (let index = 0; index < spots.length; index++) {
    spots[index] = clampZotzRoomSpot(spots[index], width, height)
  }
  return moved
}

const ROUNDS_PER_FRAME = 80
/** Rounds of the shorter push before every other round also tries sideways. */
const SIDEWAYS_AFTER = 40

/**
 * A gentle step per frame, or every step at once without motion; true once nobody overlaps.
 * `frame` counts this settle's calls: robots that keep bumping into each other start stepping
 * sideways too, since a crowded column can't make room by shuffling up and down.
 */
export function settleZotzRoomSpots(
  spots: ZotzRoomSpot[],
  tagWidths: readonly number[],
  pinned: number,
  width: number,
  height: number,
  instant: boolean,
  frame = 0
): boolean {
  const rounds = instant ? ROUNDS_PER_FRAME : 1
  for (let round = 0; round < rounds; round++) {
    const index = frame * rounds + round
    const sideways = index >= SIDEWAYS_AFTER && index % 2 === 1
    const moved = separateZotzRoomSpots(
      spots,
      tagWidths,
      pinned === -1 ? null : pinned,
      width,
      height,
      sideways
    )
    if (moved < 0.3 && !sideways) {
      return true
    }
  }
  return false
}

/** Forgets agents that left and gives new ones their saved or default spot; true when any arrived. */
export function placeZotzRoomAgents(
  spots: Map<string, ZotzRoomSpot>,
  agents: readonly { key: string }[],
  saved: Readonly<Record<string, readonly [number, number]>> | undefined,
  columns: number
): boolean {
  const keys = new Set(agents.map((agent) => agent.key))
  for (const key of spots.keys()) {
    if (!keys.has(key)) {
      spots.delete(key)
    }
  }
  let added = false
  agents.forEach((agent, index) => {
    if (spots.has(agent.key)) {
      return
    }
    const spot = saved?.[agent.key]
    spots.set(
      agent.key,
      spot ? { fx: spot[0], fy: spot[1] } : zotzDefaultRoomSpot(index, agents.length, columns)
    )
    added = true
  })
  return added
}
