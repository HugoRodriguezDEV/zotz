import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../../../../shared/execution-host'
import type {
  ZotzLinkGroup,
  ZotzLinkPeer
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'

export type ZotzLinkMember = ZotzLinkGroup['members'][number]

export function sameZotzLinkMember(a: ZotzLinkMember, b: ZotzLinkMember): boolean {
  return a.hostId === b.hostId && a.path === b.path
}

export function findZotzLinkGroup(
  groups: readonly ZotzLinkGroup[],
  member: ZotzLinkMember
): ZotzLinkGroup | null {
  return groups.find((group) => group.members.some((m) => sameZotzLinkMember(m, member))) ?? null
}

/**
 * Two servers never write to each other (each only answers the laptop that paired it), so a group
 * may hold this machine plus at most one server.
 */
export function canZotzLinkTogether(members: readonly ZotzLinkMember[]): boolean {
  const servers = new Set(members.map((m) => m.hostId).filter((h) => h !== LOCAL_EXECUTION_HOST_ID))
  return servers.size <= 1
}

/** Puts `b` in `a`'s group, merging both groups when each already had one. */
export function linkZotzMembers(
  groups: readonly ZotzLinkGroup[],
  a: ZotzLinkMember,
  b: ZotzLinkMember,
  now: number,
  newId: () => string
): ZotzLinkGroup[] {
  const groupA = findZotzLinkGroup(groups, a)
  const groupB = findZotzLinkGroup(groups, b)
  if (groupA && groupA === groupB) {
    return [...groups]
  }
  const members = [...(groupA?.members ?? [a]), ...(groupB?.members ?? [b])]
  const kept = groupA ?? groupB
  const merged: ZotzLinkGroup = {
    ...kept,
    id: kept?.id ?? newId(),
    members,
    createdAt: kept?.createdAt ?? now
  }
  return [...groups.filter((g) => g !== groupA && g !== groupB), merged]
}

/** Takes one member out; an unnamed link left with a single member is gone, a named group stays. */
export function unlinkZotzMember(
  groups: readonly ZotzLinkGroup[],
  member: ZotzLinkMember
): ZotzLinkGroup[] {
  return groups.flatMap((group) => {
    const members = group.members.filter((m) => !sameZotzLinkMember(m, member))
    if (members.length === group.members.length) {
      return [group]
    }
    return members.length > 1 || group.name !== undefined ? [{ ...group, members }] : []
  })
}

/** Groups in sidebar order: by `order`, then oldest first. */
export function sortZotzGroups(groups: readonly ZotzLinkGroup[]): ZotzLinkGroup[] {
  return [...groups].sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt - b.createdAt
  )
}

/** Renumbers `order` to match the given sequence. */
function withOrder(groups: readonly ZotzLinkGroup[]): ZotzLinkGroup[] {
  return groups.map((group, index) => ({ ...group, order: index }))
}

export function createZotzGroup(
  groups: readonly ZotzLinkGroup[],
  name: string,
  now: number,
  id: string
): ZotzLinkGroup[] {
  return withOrder([...sortZotzGroups(groups), { id, name, members: [], createdAt: now }])
}

export function renameZotzGroup(
  groups: readonly ZotzLinkGroup[],
  id: string,
  name: string
): ZotzLinkGroup[] {
  return groups.map((group) => (group.id === id ? { ...group, name } : group))
}

/** Deletes the group: its members go back to their projects, unlinked. */
export function removeZotzGroup(groups: readonly ZotzLinkGroup[], id: string): ZotzLinkGroup[] {
  return groups.filter((group) => group.id !== id)
}

/**
 * Moves a member into a group at `index` (end when absent), out of any other group. Null when the
 * group is gone or would hold two servers.
 */
export function moveZotzMemberToGroup(
  groups: readonly ZotzLinkGroup[],
  member: ZotzLinkMember,
  groupId: string,
  index?: number
): ZotzLinkGroup[] | null {
  const target = groups.find((group) => group.id === groupId)
  if (!target) {
    return null
  }
  const others = target.members.filter((m) => !sameZotzLinkMember(m, member))
  if (!canZotzLinkTogether([...others, member])) {
    return null
  }
  const members = [...others]
  members.splice(Math.max(0, Math.min(index ?? members.length, members.length)), 0, member)
  return groups.flatMap((group) =>
    group.id === groupId ? [{ ...target, members }] : unlinkZotzMember([group], member)
  )
}

/** Moves a group to `index` among the sorted groups. */
export function reorderZotzGroup(
  groups: readonly ZotzLinkGroup[],
  id: string,
  index: number
): ZotzLinkGroup[] {
  const sorted = sortZotzGroups(groups)
  const moving = sorted.find((group) => group.id === id)
  if (!moving) {
    return [...groups]
  }
  const rest = sorted.filter((group) => group !== moving)
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, moving)
  return withOrder(rest)
}

export type ZotzLinkMemberInfo = { shortName: string; title: string }

/**
 * Partners of `member` as its own machine sees them: same machine writes directly; this machine
 * reaches a server with `--on`; a server only answers this machine (it cannot start mail to it).
 */
export function zotzLinkPeersFor(
  member: ZotzLinkMember,
  group: ZotzLinkGroup,
  describe: (member: ZotzLinkMember) => ZotzLinkMemberInfo,
  machineName: (hostId: ExecutionHostId) => string
): ZotzLinkPeer[] {
  return group.members
    .filter((peer) => !sameZotzLinkMember(peer, member))
    .map((peer) => {
      const info = describe(peer)
      if (peer.hostId === member.hostId) {
        return { ...info, machine: null, reach: 'direct' }
      }
      return {
        ...info,
        machine: machineName(peer.hostId),
        reach: member.hostId === LOCAL_EXECUTION_HOST_ID ? 'on-server' : 'reply-only'
      }
    })
}
