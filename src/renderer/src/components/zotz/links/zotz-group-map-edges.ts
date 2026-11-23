import type { ZotzLinkMessage } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'

/** One line of the group map: two members (lower index first) and how much they wrote. */
export type ZotzGroupMapEdge = { a: number; b: number; count: number; lastAt: number }

export function zotzEdgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
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
    const from = memberIndexOf(message.fromLabel ?? message.from)
    const to = memberIndexOf(message.to)
    if (from === null || to === null || from === to) {
      continue
    }
    const key = zotzEdgeKey(from, to)
    const edge = edges.get(key) ?? {
      a: Math.min(from, to),
      b: Math.max(from, to),
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

/** Whether a message is between the two members of a selected pair. */
export function isZotzMessageInPair(
  message: ZotzLinkMessage,
  pair: { a: number; b: number },
  memberIndexOf: (addressOrLabel: string) => number | null
): boolean {
  const from = memberIndexOf(message.fromLabel ?? message.from)
  const to = memberIndexOf(message.to)
  return from !== null && to !== null && zotzEdgeKey(from, to) === zotzEdgeKey(pair.a, pair.b)
}
