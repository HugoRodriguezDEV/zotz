import { useEffect, useMemo, useRef, useState } from 'react'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { useAppStore } from '@/store/index'
import type {
  ZotzConversationEntry,
  ZotzLinkGroup,
  ZotzLinkMessage
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { ZotzGroupMapNode } from './ZotzGroupMap'
import { buildZotzGroupMapEdges, zotzEdgeKey, type ZotzGroupMapEdge } from './zotz-group-map-edges'
import { sameZotzLinkMember, type ZotzLinkMember } from './zotz-link-groups'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'

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

  const repos = useAppStore((store) => store.repos)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const parentEdges = zotzGroupParentEdges(members, repos, worktreesByRepo)

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

/** Dashed child → parent lines among a group's members (same machine only). */
function zotzGroupParentEdges(
  members: readonly ZotzLinkMember[],
  repos: readonly Repo[],
  worktreesByRepo: Readonly<Record<string, readonly Worktree[] | undefined>>
): { child: number; parent: number }[] {
  const worktreeOf = (member: ZotzLinkMember): Worktree | null => {
    for (const repo of repos) {
      if (getRepoExecutionHostId(repo) !== member.hostId) {
        continue
      }
      const match = (worktreesByRepo[repo.id] ?? []).find((w) => w.path === member.path)
      if (match) {
        return match
      }
    }
    return null
  }
  const worktrees = members.map(worktreeOf)
  return members.flatMap((member, child) => {
    const parentId = worktrees[child]?.cliProvenance?.zotzParentWorktreeId
    const parent = parentId
      ? worktrees.findIndex(
          (candidate, i) => candidate?.id === parentId && members[i].hostId === member.hostId
        )
      : -1
    return parent === -1 || parent === child ? [] : [{ child, parent }]
  })
}
