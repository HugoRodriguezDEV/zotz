import type { ZotzConversationEntry } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import { sameZotzLinkMember, type ZotzLinkMember } from './zotz-link-groups'

/** How a conversation outside the group relates to a member: it created one, or one created it. */
export type ZotzFamilyRole = 'parent' | 'worker'

/**
 * Who created whom among each machine's conversations: a worker (`orchestration worker-start`, or
 * a CLI create by an agent) records its creator's worktree as `cliProvenance.zotzParentWorktreeId`,
 * the same link that nests it under its parent in the sidebar. Parents are on the same machine.
 */
export type ZotzFamilyIndex = {
  parentOf: (member: ZotzLinkMember) => ZotzLinkMember | null
  childrenOf: (member: ZotzLinkMember) => ZotzLinkMember[]
}

const keyOf = (member: ZotzLinkMember): string => `${member.hostId}\n${member.path}`

export function buildZotzFamilyIndex(
  lists: ReadonlyMap<ExecutionHostId, readonly ZotzConversationEntry[]>,
  /** The parent worktree id this window recorded, for hosts whose list predates `parentWorktreeId`. */
  recordedParentId: (member: ZotzLinkMember) => string | null
): ZotzFamilyIndex {
  const byWorktree = new Map<string, ZotzLinkMember>()
  for (const [hostId, entries] of lists) {
    for (const entry of entries) {
      byWorktree.set(`${hostId}\n${entry.worktreeId}`, { hostId, path: entry.path })
    }
  }
  const parents = new Map<string, ZotzLinkMember>()
  const children = new Map<string, ZotzLinkMember[]>()
  for (const [hostId, entries] of lists) {
    for (const entry of entries) {
      const member = { hostId, path: entry.path }
      const parentId =
        entry.parentWorktreeId === undefined ? recordedParentId(member) : entry.parentWorktreeId
      const parent = parentId ? byWorktree.get(`${hostId}\n${parentId}`) : undefined
      if (!parent || sameZotzLinkMember(parent, member)) {
        continue
      }
      parents.set(keyOf(member), parent)
      children.set(keyOf(parent), [...(children.get(keyOf(parent)) ?? []), member])
    }
  }
  return {
    parentOf: (member) => parents.get(keyOf(member)) ?? null,
    childrenOf: (member) => children.get(keyOf(member)) ?? []
  }
}

/** The whole tree a conversation belongs to: its oldest ancestor first, then every descendant. */
export function zotzFamilyOf(index: ZotzFamilyIndex, member: ZotzLinkMember): ZotzLinkMember[] {
  // Stored data can hold a cycle; stop at the first repeat.
  const climbed = new Set([keyOf(member)])
  let root = member
  for (let parent = index.parentOf(root); parent; parent = index.parentOf(root)) {
    if (climbed.has(keyOf(parent))) {
      break
    }
    climbed.add(keyOf(parent))
    root = parent
  }
  const family: ZotzLinkMember[] = []
  const seen = new Set<string>()
  const queue = [root]
  for (let at = 0; at < queue.length; at++) {
    const next = queue[at]
    if (seen.has(keyOf(next))) {
      continue
    }
    seen.add(keyOf(next))
    family.push(next)
    queue.push(...index.childrenOf(next))
  }
  return family
}

/** Parents and workers of a group's members that aren't in the group, each once. */
export function zotzFamilyExtras(
  index: ZotzFamilyIndex,
  members: readonly ZotzLinkMember[]
): { member: ZotzLinkMember; role: ZotzFamilyRole }[] {
  const taken = new Set(members.map(keyOf))
  const extras: { member: ZotzLinkMember; role: ZotzFamilyRole }[] = []
  const add = (member: ZotzLinkMember | null, role: ZotzFamilyRole): void => {
    if (member && !taken.has(keyOf(member))) {
      taken.add(keyOf(member))
      extras.push({ member, role })
    }
  }
  for (const member of members) {
    add(index.parentOf(member), 'parent')
    index.childrenOf(member).forEach((child) => add(child, 'worker'))
  }
  return extras
}

/** Child → parent pairs among `members`, by position. */
export function zotzFamilyEdges(
  index: ZotzFamilyIndex,
  members: readonly ZotzLinkMember[]
): { child: number; parent: number }[] {
  return members.flatMap((member, child) => {
    const parentOf = index.parentOf(member)
    const parent = parentOf ? members.findIndex((m) => sameZotzLinkMember(m, parentOf)) : -1
    return parent === -1 || parent === child ? [] : [{ child, parent }]
  })
}
