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
  const merged: ZotzLinkGroup = {
    id: groupA?.id ?? groupB?.id ?? newId(),
    members,
    createdAt: groupA?.createdAt ?? groupB?.createdAt ?? now
  }
  return [...groups.filter((g) => g !== groupA && g !== groupB), merged]
}

/** Takes one member out; a group left with a single member is gone. */
export function unlinkZotzMember(
  groups: readonly ZotzLinkGroup[],
  member: ZotzLinkMember
): ZotzLinkGroup[] {
  return groups.flatMap((group) => {
    const members = group.members.filter((m) => !sameZotzLinkMember(m, member))
    if (members.length === group.members.length) {
      return [group]
    }
    return members.length > 1 ? [{ ...group, members }] : []
  })
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
