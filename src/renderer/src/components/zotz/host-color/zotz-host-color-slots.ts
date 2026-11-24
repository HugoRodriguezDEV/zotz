/** Existing distinct-hue tokens with light and dark values; a machine's color is one of these. */
export const ZOTZ_HOST_COLOR_TOKENS = [
  '--git-graph-lane-4',
  '--git-graph-lane-5',
  '--git-graph-lane-2',
  '--git-graph-lane-1',
  '--git-graph-lane-3'
] as const

function preferredSlot(hostId: string): number {
  // FNV-1a: the same id prefers the same slot on every client and every launch.
  let hash = 0x811c9dc5
  for (let index = 0; index < hostId.length; index += 1) {
    hash ^= hostId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % ZOTZ_HOST_COLOR_TOKENS.length
}

/**
 * A palette slot per machine. Each keeps its preferred slot unless a smaller id claims it first;
 * the rest take the next free one, so up to five machines never share a color and adding one
 * moves at most the machines that collide with it.
 */
export function assignZotzHostColorSlots(hostIds: readonly string[]): Map<string, number> {
  const sorted = [...new Set(hostIds)].sort()
  const slots = new Map<string, number>()
  const taken = new Set<number>()
  const losers: string[] = []
  for (const hostId of sorted) {
    const slot = preferredSlot(hostId)
    if (taken.has(slot)) {
      losers.push(hostId)
    } else {
      taken.add(slot)
      slots.set(hostId, slot)
    }
  }
  for (const hostId of losers) {
    let slot = preferredSlot(hostId)
    for (let step = 0; step < ZOTZ_HOST_COLOR_TOKENS.length && taken.has(slot); step += 1) {
      slot = (slot + 1) % ZOTZ_HOST_COLOR_TOKENS.length
    }
    taken.add(slot)
    slots.set(hostId, slot)
  }
  return slots
}

/** The machine's color, or its preferred one when it is not among the known machines yet. */
export function zotzHostColorVar(slots: ReadonlyMap<string, number>, hostId: string): string {
  const slot = slots.get(hostId) ?? preferredSlot(hostId)
  return `var(${ZOTZ_HOST_COLOR_TOKENS[slot]})`
}
