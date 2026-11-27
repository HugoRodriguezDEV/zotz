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

// Feet of the top row leave room for the head and its bubble; rows clear a robot plus its tag.
const TOP = 80
const ROW = 96
const BOTTOM = 52
const MIN_Y = 72

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
  return { x0: 44, x1: Math.max(44, width - 44), y0: 74, y1: Math.max(74, height - 28) }
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

/**
 * One step of pushing apart robots whose name tags would overlap; `pinned` (the one being moved)
 * stays put. Mutates `spots` and returns the largest move in pixels, so callers know when it settled.
 */
export function separateZotzRoomSpots(
  spots: ZotzRoomSpot[],
  tagWidths: readonly number[],
  pinned: number | null,
  width: number,
  height: number,
  strength = 0.25
): number {
  let moved = 0
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const dx = (spots[j].fx - spots[i].fx) * width
      const dy = (spots[j].fy - spots[i].fy) * height
      const overlapX = (tagWidths[i] + tagWidths[j]) / 2 + 8 - Math.abs(dx)
      const overlapY = MIN_Y - Math.abs(dy)
      if (overlapX <= 0 || overlapY <= 0) {
        continue
      }
      const moveI = pinned !== i
      const moveJ = pinned !== j
      const share = moveI && moveJ ? 0.5 : 1
      // Slide along the axis that needs the shorter push; ties go sideways.
      const alongX = overlapX < overlapY
      const push = (alongX ? overlapX : overlapY) * strength * share
      // Exactly stacked: i goes one way, j the other.
      const sign = Math.sign(alongX ? dx : dy) || 1
      const step = sign * push
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

/** A gentle step per frame, or every step at once without motion; true once nobody overlaps. */
export function settleZotzRoomSpots(
  spots: ZotzRoomSpot[],
  tagWidths: readonly number[],
  pinned: number,
  width: number,
  height: number,
  instant: boolean
): boolean {
  for (let round = 0; round < (instant ? 80 : 1); round++) {
    if (
      separateZotzRoomSpots(spots, tagWidths, pinned === -1 ? null : pinned, width, height) < 0.3
    ) {
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
