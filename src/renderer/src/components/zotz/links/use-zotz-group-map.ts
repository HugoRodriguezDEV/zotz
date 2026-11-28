import { useEffect, useMemo, useRef, useState } from 'react'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { useAppStore } from '@/store/index'
import type {
  ZotzConversationEntry,
  ZotzLinkGroup,
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
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'

export type ZotzGroupMapData = {
  nodes: ZotzGroupMapNode[]
  edges: ZotzGroupMapEdge[]
  parentEdges: { child: number; parent: number }[]
  /** Mail from the latest poll that wasn't there before, with who wrote to whom. */
  mail: readonly ZotzGroupMapMail[]
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
      machine: machineName(member),
      agent: entry?.agent ?? null,
      state: entry?.state ?? null,
      current: active !== null && sameZotzLinkMember(member, active)
    }
  })
  const edges = buildZotzGroupMapEdges(messages, memberIndexOf)

  const repos = useAppStore((store) => store.repos)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const parentEdges = zotzGroupParentEdges(members, repos, worktreesByRepo)

  const [mail, setMail] = useState<readonly ZotzGroupMapMail[]>([])
  const seen = useRef<{ group: string; ids: Set<string>; openedAt: number } | null>(null)
  const groupId = group?.id ?? ''
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
