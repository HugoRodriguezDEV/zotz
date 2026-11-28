import type { ZotzLinkMessage } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'

/** One line of the group map: two members (lower index first) and how much they wrote. */
export type ZotzGroupMapEdge = { a: number; b: number; count: number; lastAt: number }

/** A message that just arrived, by member index; `firstOfPair` when the two never wrote before. */
export type ZotzGroupMapMail = { id: string; from: number; to: number; firstOfPair: boolean }

export function zotzEdgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function endsOf(
  message: ZotzLinkMessage,
  memberIndexOf: (addressOrLabel: string) => number | null
): { from: number; to: number } | null {
  const from = memberIndexOf(message.fromLabel ?? message.from)
  const to = memberIndexOf(message.to)
  return from === null || to === null || from === to ? null : { from, to }
}

/**
 * Mail counted per pair of members, either direction. `memberIndexOf` maps an address (or a
 * remote sender label that contains one) to its member; mail to or from outside the group is skipped.
 */
export function buildZotzGroupMapEdges(
  messages: readonly ZotzLinkMessage[],
  memberIndexOf: (addressOrLabel: string) => number | null
): ZotzGroupMapEdge[] {
  const edges = new Map<string, ZotzGroupMapEdge>()
  for (const message of messages) {
    const ends = endsOf(message, memberIndexOf)
    if (!ends) {
      continue
    }
    const key = zotzEdgeKey(ends.from, ends.to)
    const edge = edges.get(key) ?? {
      a: Math.min(ends.from, ends.to),
      b: Math.max(ends.from, ends.to),
      count: 0,
      lastAt: 0
    }
    edges.set(key, {
      ...edge,
      count: edge.count + 1,
      lastAt: Math.max(edge.lastAt, message.createdAt)
    })
  }
  return [...edges.values()]
}

/** Fresh mail between members, oldest first, with who wrote to whom. */
export function buildZotzGroupMapMail(
  fresh: readonly ZotzLinkMessage[],
  earlierPairs: ReadonlySet<string>,
  memberIndexOf: (addressOrLabel: string) => number | null
): ZotzGroupMapMail[] {
  const pairs = new Set(earlierPairs)
  return [...fresh]
    .sort((x, y) => x.createdAt - y.createdAt)
    .flatMap((message) => {
      const ends = endsOf(message, memberIndexOf)
      if (!ends) {
        return []
      }
      const key = zotzEdgeKey(ends.from, ends.to)
      const firstOfPair = !pairs.has(key)
      pairs.add(key)
      return [{ id: message.id, ...ends, firstOfPair }]
    })
}

/** Whether a member wrote or received a message. */
export function isZotzMessageOfMember(
  message: ZotzLinkMessage,
  member: number,
  memberIndexOf: (addressOrLabel: string) => number | null
): boolean {
  const ends = endsOf(message, memberIndexOf)
  return ends !== null && (ends.from === member || ends.to === member)
}
