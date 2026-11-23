import type { ExecutionHostId } from '../../../../../shared/execution-host'
import type { ZotzLinkGroup } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { CliWorkspaceProvenance } from '../../../../../shared/worktree/types'
import {
  createZotzGroup,
  findZotzLinkGroup,
  moveZotzMemberToGroup,
  type ZotzLinkMember
} from './zotz-link-groups'

/** A conversation an agent created, as the sidebar sees it. */
export type ZotzCreatedConversation = {
  member: ZotzLinkMember
  worktreeId: string
  provenance: Pick<CliWorkspaceProvenance, 'zotzGroup' | 'zotzParentWorktreeId'>
}

export type ZotzGroupPlacement = {
  groups: ZotzLinkGroup[]
  /** Keys handled now; each conversation is placed at most once. */
  placed: string[]
  changed: boolean
}

export function zotzPlacementKey(member: ZotzLinkMember): string {
  return `${member.hostId}\n${member.path}`
}

/**
 * Puts each new agent-created conversation in its group: the one named with `--group` (created when
 * missing), else its parent's. Already grouped or already handled ones are left alone.
 */
export function placeZotzCreatedConversations(input: {
  groups: readonly ZotzLinkGroup[]
  created: readonly ZotzCreatedConversation[]
  placed: ReadonlySet<string>
  /** Member of a worktree on a machine, to find a parent's group. */
  memberOf: (hostId: ExecutionHostId, worktreeId: string) => ZotzLinkMember | null
  now: number
  newId: () => string
}): ZotzGroupPlacement {
  let groups = [...input.groups]
  const placed: string[] = []
  let changed = false
  for (const conversation of input.created) {
    const key = zotzPlacementKey(conversation.member)
    const { zotzGroup, zotzParentWorktreeId } = conversation.provenance
    if (input.placed.has(key) || (!zotzGroup && !zotzParentWorktreeId)) {
      continue
    }
    placed.push(key)
    if (findZotzLinkGroup(groups, conversation.member)) {
      continue
    }
    let groupId: string | null = null
    if (zotzGroup) {
      const wanted = zotzGroup.trim().toLowerCase()
      groupId = groups.find((group) => group.name?.trim().toLowerCase() === wanted)?.id ?? null
      if (!groupId) {
        groupId = input.newId()
        groups = createZotzGroup(groups, zotzGroup.trim(), input.now, groupId)
        changed = true
      }
    } else if (zotzParentWorktreeId) {
      const parent = input.memberOf(conversation.member.hostId, zotzParentWorktreeId)
      groupId = parent ? (findZotzLinkGroup(groups, parent)?.id ?? null) : null
    }
    const next = groupId ? moveZotzMemberToGroup(groups, conversation.member, groupId) : null
    if (next) {
      groups = next
      changed = true
    }
  }
  return { groups, placed, changed }
}
