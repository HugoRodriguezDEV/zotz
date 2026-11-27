import { useEffect, useRef, useState } from 'react'
import type {
  ZotzConversationEntry,
  ZotzLinkMessage
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { ZotzGroupMapNode } from './ZotzGroupMap'
import {
  buildZotzGroupMapEdges,
  buildZotzGroupMapMail,
  zotzEdgeKey,
  type ZotzGroupMapEdge,
  type ZotzGroupMapMail
} from './zotz-group-map-edges'
import { sameZotzLinkMember, type ZotzLinkMember } from './zotz-link-groups'
import type { ZotzFamilyRole } from './zotz-link-family'

export type ZotzGroupMapData = {
  nodes: ZotzGroupMapNode[]
  edges: ZotzGroupMapEdge[]
  parentEdges: { child: number; parent: number }[]
  /** Mail from the latest poll that wasn't there before, with who wrote to whom. */
  mail: readonly ZotzGroupMapMail[]
  memberIndexOf: (addressOrLabel: string) => number | null
}

/**
 * Nodes, lines and recent activity of a room of conversations (a group, plus the parents and
 * workers of its members, or a conversation's own family), from its members and their mail.
 */
export function useZotzGroupMap(input: {
  /** The group's id or the family's; mail seen in another room is history here. */
  roomId: string | null
  members: readonly ZotzLinkMember[]
  /** Set for parents and workers shown beside a group without being in it. */
  roleOf: (member: ZotzLinkMember) => ZotzFamilyRole | null
  /** Child → parent pairs among `members`, by position. */
  parentEdges: { child: number; parent: number }[]
  active: ZotzLinkMember | null
  messages: readonly ZotzLinkMessage[]
  entryFor: (member: ZotzLinkMember) => ZotzConversationEntry | null
  machineName: (member: ZotzLinkMember) => string | null
}): ZotzGroupMapData {
  const { roomId, members, roleOf, parentEdges, active, messages, entryFor, machineName } = input
  const entries = members.map(entryFor)
  const addressKey = entries.map((entry) => entry?.address ?? '').join('\n')
  const memberIndexOf = (addressOrLabel: string): number | null =>
    indexInAddresses(addressKey, addressOrLabel)
  const nodes = members.map((member, index): ZotzGroupMapNode => {
    const entry = entries[index]
    return {
      key: `${member.hostId}\n${member.path}`,
      label: entry?.shortName || member.path.split(/[\\/]/).at(-1) || member.path,
      machine: machineName(member),
      agent: entry?.agent ?? null,
      state: entry?.state ?? null,
      kin: roleOf(member),
      current: active !== null && sameZotzLinkMember(member, active)
    }
  })
  const edges = buildZotzGroupMapEdges(messages, memberIndexOf)

  const [mail, setMail] = useState<readonly ZotzGroupMapMail[]>([])
  const seen = useRef<{ group: string; ids: Set<string>; openedAt: number } | null>(null)
  const groupId = roomId ?? ''
  useEffect(() => {
    const same = seen.current?.group === groupId ? seen.current : null
    const openedAt = same?.openedAt ?? Date.now()
    seen.current = { group: groupId, ids: new Set(messages.map((message) => message.id)), openedAt }
    // The list starts empty while it loads: what was written before the group opened is history.
    const isNews = (message: ZotzLinkMessage): boolean =>
      same !== null &&
      !same.ids.has(message.id) &&
      (same.ids.size > 0 || message.createdAt >= openedAt)
    if (!messages.some(isNews)) {
      return
    }
    const indexOf = (addressOrLabel: string): number | null =>
      indexInAddresses(addressKey, addressOrLabel)
    const earlier = messages.filter((message) => !isNews(message))
    const fresh = buildZotzGroupMapMail(
      messages.filter(isNews),
      new Set(buildZotzGroupMapEdges(earlier, indexOf).map((edge) => zotzEdgeKey(edge.a, edge.b))),
      indexOf
    )
    if (fresh.length > 0) {
      setMail(fresh)
    }
  }, [messages, addressKey, groupId])

  return { nodes, edges, parentEdges, mail, memberIndexOf }
}

/** Member index of the address inside `addressOrLabel`, from newline-joined member addresses. */
function indexInAddresses(addressKey: string, addressOrLabel: string): number | null {
  const index = addressKey
    .split('\n')
    .findIndex((address) => address !== '' && addressOrLabel.includes(address))
  return index === -1 ? null : index
}
