// Where the robots stand on the group map: default spots, bounds and keeping name tags apart.
// Positions are fractions of the stage so they survive a resized panel.

/** Full-body robot at scale 3: 12×14 cells. */
export const ZOTZ_MAP_SPRITE_SCALE = 3
export const ZOTZ_MAP_SPRITE_W = 12 * ZOTZ_MAP_SPRITE_SCALE
export const ZOTZ_MAP_SPRITE_H = 14 * ZOTZ_MAP_SPRITE_SCALE

export type ZotzMapSpot = { fx: number; fy: number }

/** Box (around the feet) that grabs a robot, its bubble and its tag. */
export const ZOTZ_MAP_HIT = { halfWidth: 28, above: ZOTZ_MAP_SPRITE_H + 10, below: 26 }

/** The robot under a point; the one in front wins. */
export function hitZotzMapAgent(
  agents: readonly { key: string; at: { x: number; y: number } }[],
  x: number,
  y: number
): string | null {
  const front = [...agents].sort((a, b) => b.at.y - a.at.y)
  return (
    front.find(
      ({ at }) =>
        Math.abs(x - at.x) <= ZOTZ_MAP_HIT.halfWidth &&
        y >= at.y - ZOTZ_MAP_HIT.above &&
        y <= at.y + ZOTZ_MAP_HIT.below
    )?.key ?? null
  )
}

// Feet of the top row leave room for the head and its bubble; rows clear a robot plus its tag.
const TOP = 80
const ROW = 96
const BOTTOM = 52
const MIN_Y = 72

function rowsFor(count: number): number {
  return count <= 2 ? 1 : Math.ceil(count / 2)
}

export function zotzGroupStageHeight(count: number): number {
  return Math.max(200, TOP + (rowsFor(count) - 1) * ROW + BOTTOM)
}

/** Feet bounds in pixels; keeps the head, bubble and name tag inside the stage. */
export function zotzGroupStageBounds(
  width: number,
  height: number
): { x0: number; x1: number; y0: number; y1: number } {
  return { x0: 44, x1: Math.max(44, width - 44), y0: 74, y1: Math.max(74, height - 28) }
}

/** Two per row; an odd last one stands centered. Three members make a triangle. */
export function zotzDefaultMapSpot(index: number, count: number): ZotzMapSpot {
  const height = zotzGroupStageHeight(count)
  if (count <= 2) {
    return { fx: count === 1 ? 0.5 : index === 0 ? 0.27 : 0.73, fy: 0.62 }
  }
  if (count === 3) {
    return index === 0
      ? { fx: 0.5, fy: TOP / height }
      : { fx: index === 1 ? 0.25 : 0.75, fy: (TOP + ROW) / height }
  }
  const row = Math.floor(index / 2)
  const alone = count % 2 === 1 && index === count - 1
  return { fx: alone ? 0.5 : index % 2 === 0 ? 0.27 : 0.73, fy: (TOP + row * ROW) / height }
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value))

/** Pulls a spot back inside the stage. */
export function clampZotzMapSpot(spot: ZotzMapSpot, width: number, height: number): ZotzMapSpot {
  const bounds = zotzGroupStageBounds(width, height)
  return {
    fx: clamp(spot.fx * width, bounds.x0, bounds.x1) / width,
    fy: clamp(spot.fy * height, bounds.y0, bounds.y1) / height
  }
}

/**
 * One step of pushing apart robots whose name tags would overlap; `pinned` (the one being moved)
 * stays put. Mutates `spots` and returns the largest move in pixels, so callers know when it settled.
 */
export function separateZotzMapSpots(
  spots: ZotzMapSpot[],
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
    spots[index] = clampZotzMapSpot(spots[index], width, height)
  }
  return moved
}

/** A gentle step per frame, or every step at once without motion; true once nobody overlaps. */
export function settleZotzMapSpots(
  spots: ZotzMapSpot[],
  tagWidths: readonly number[],
  pinned: number,
  width: number,
  height: number,
  instant: boolean
): boolean {
  for (let round = 0; round < (instant ? 80 : 1); round++) {
    if (
      separateZotzMapSpots(spots, tagWidths, pinned === -1 ? null : pinned, width, height) < 0.3
    ) {
      return true
    }
  }
  return false
}
