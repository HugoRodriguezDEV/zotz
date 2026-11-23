import { useEffect, useMemo, useRef, useState } from 'react'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { useAppStore } from '@/store/index'
import { findWorktreeById } from '@/store/github/refresh/worktree-refresh'
import type {
  ZotzConversationEntry,
  ZotzLinkGroup,
  ZotzLinkMessage
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { ZotzGroupMapNode } from './ZotzGroupMap'
import { buildZotzGroupMapEdges, zotzEdgeKey, type ZotzGroupMapEdge } from './zotz-group-map-edges'
import { sameZotzLinkMember, type ZotzLinkMember } from './zotz-link-groups'
import { findZotzLinkWorktreeId } from './zotz-link-worktrees'

// Long enough to notice between two 8 s polls.
const ACTIVE_MS = 6_000

export type ZotzGroupMapData = {
  nodes: ZotzGroupMapNode[]
  edges: ZotzGroupMapEdge[]
  parentEdges: { child: number; parent: number }[]
  activeEdges: ReadonlySet<string>
  memberIndexOf: (addressOrLabel: string) => number | null
}

/** Nodes, lines and recent activity of a group's map, from its members and their mail. */
export function useZotzGroupMap(input: {
  group: ZotzLinkGroup | null
  active: ZotzLinkMember | null
  messages: readonly ZotzLinkMessage[]
  entryFor: (member: ZotzLinkMember) => ZotzConversationEntry | null
  machineName: (member: ZotzLinkMember) => string | null
}): ZotzGroupMapData {
  const { group, active, messages, entryFor, machineName } = input
  const members = useMemo(() => group?.members ?? [], [group])
  const entries = members.map(entryFor)
  const addressKey = entries.map((entry) => entry?.address ?? '').join('\n')
  const memberIndexOf = (addressOrLabel: string): number | null =>
    indexInAddresses(addressKey, addressOrLabel)
  const nodes = members.map((member, index): ZotzGroupMapNode => {
    const entry = entries[index]
    return {
      key: `${member.hostId}\n${member.path}`,
      label: entry?.shortName || member.path.split(/[\\/]/).at(-1) || member.path,
      detail: machineName(member) ?? entry?.projectName ?? '',
      state: entry?.state ?? null,
      current: active !== null && sameZotzLinkMember(member, active)
    }
  })
  const edges = buildZotzGroupMapEdges(messages, memberIndexOf)

  // Subscribed so a child's recorded parent shows as soon as its worktree arrives.
  useAppStore(selectWorktreesByRepo)
  const state = useAppStore.getState()
  const ids = members.map((member) => findZotzLinkWorktreeId(state, member))
  const parentEdges = members.flatMap((member, child) => {
    const id = ids[child]
    const parentId = id ? findWorktreeById(state, id)?.cliProvenance?.zotzParentWorktreeId : null
    const parent = parentId
      ? ids.findIndex(
          (candidate, i) => candidate === parentId && members[i].hostId === member.hostId
        )
      : -1
    return parent === -1 || parent === child ? [] : [{ child, parent }]
  })

  const [activeEdges, setActiveEdges] = useState<ReadonlySet<string>>(new Set())
  const seen = useRef<{ group: string; ids: Set<string> } | null>(null)
  const groupId = group?.id ?? ''
  useEffect(() => {
    const previous = seen.current?.group === groupId ? seen.current.ids : null
    seen.current = { group: groupId, ids: new Set(messages.map((message) => message.id)) }
    // The first list for a group is history, not news.
    if (!previous) {
      return
    }
    const fresh = new Set(
      buildZotzGroupMapEdges(
        messages.filter((message) => !previous.has(message.id)),
        (addressOrLabel) => indexInAddresses(addressKey, addressOrLabel)
      ).map((edge) => zotzEdgeKey(edge.a, edge.b))
    )
    if (fresh.size === 0) {
      return
    }
    setActiveEdges(fresh)
    const timer = window.setTimeout(() => setActiveEdges(new Set()), ACTIVE_MS)
    return () => window.clearTimeout(timer)
  }, [messages, addressKey, groupId])

  return { nodes, edges, parentEdges, activeEdges, memberIndexOf }
}

/** Member index of the address inside `addressOrLabel`, from newline-joined member addresses. */
function indexInAddresses(addressKey: string, addressOrLabel: string): number | null {
  const index = addressKey
    .split('\n')
    .findIndex((address) => address !== '' && addressOrLabel.includes(address))
  return index === -1 ? null : index
}
