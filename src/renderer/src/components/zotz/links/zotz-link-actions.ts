import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import { toast } from 'sonner'
import { useAppStore } from '@/store/index'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { translate } from '@/i18n/i18n'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import type {
  ZotzLinkGroup,
  ZotzLinkSetPeersParams
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { ZotzLinkHost } from './use-zotz-link-data'
import {
  findZotzLinkGroup,
  linkZotzMembers,
  createZotzGroup,
  moveZotzMemberToGroup,
  removeZotzGroup,
  renameZotzGroup,
  reorderZotzGroup,
  sameZotzLinkMember,
  unlinkZotzMember,
  zotzLinkPeersFor,
  type ZotzLinkMember,
  type ZotzLinkMemberInfo
} from './zotz-link-groups'

export type ZotzLinkContext = {
  hosts: readonly ZotzLinkHost[]
  /** Short name and title of a member, when this window knows it. */
  describe: (member: ZotzLinkMember) => ZotzLinkMemberInfo | null
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) ?? path
}

function groupsChangedFor(
  prev: readonly ZotzLinkGroup[],
  next: readonly ZotzLinkGroup[]
): ZotzLinkMember[] {
  const touched: ZotzLinkMember[] = []
  const add = (member: ZotzLinkMember): void => {
    if (!touched.some((m) => sameZotzLinkMember(m, member))) {
      touched.push(member)
    }
  }
  const signature = (group: ZotzLinkGroup | null): string =>
    group ? group.members.map((m) => `${m.hostId}\n${m.path}`).join('\t') : ''
  for (const group of [...prev, ...next]) {
    for (const member of group.members) {
      if (
        signature(findZotzLinkGroup(prev, member)) !== signature(findZotzLinkGroup(next, member))
      ) {
        add(member)
      }
    }
  }
  return touched
}

/** Saves the groups, then tells every conversation whose partners changed, on its own machine. */
export async function commitZotzLinks(
  next: ZotzLinkGroup[],
  context: ZotzLinkContext
): Promise<void> {
  const state = useAppStore.getState()
  const prev = state.settings?.zotzConversationLinks ?? []
  await state.updateSettings({ zotzConversationLinks: next })
  const machineName = (hostId: ExecutionHostId): string =>
    context.hosts.find((h) => h.hostId === hostId)?.name ?? hostId
  const describe = (member: ZotzLinkMember): ZotzLinkMemberInfo => {
    const info = context.describe(member)
    return {
      shortName: info?.shortName || basename(member.path),
      title: info?.title || basename(member.path)
    }
  }
  const failed: string[] = []
  await Promise.all(
    groupsChangedFor(prev, next).map(async (member) => {
      const host = context.hosts.find((h) => h.hostId === member.hostId)
      if (!host?.supported) {
        return
      }
      const group = findZotzLinkGroup(next, member)
      const params: ZotzLinkSetPeersParams = {
        path: member.path,
        peers: group ? zotzLinkPeersFor(member, group, describe, machineName) : []
      }
      try {
        await callRuntimeRpc(host.target, 'zotz.links.setPeers', params, { timeoutMs: 15_000 })
      } catch {
        failed.push(describe(member).shortName)
      }
    })
  )
  if (failed.length > 0) {
    toast.error(
      translate(
        'zotz.links.notifyFailed',
        "Linked, but couldn't tell {{names}}. They'll hear about it when their machine answers.",
        { names: failed.join(', ') }
      )
    )
  }
}

export function linkZotzConversations(
  a: ZotzLinkMember,
  b: ZotzLinkMember,
  context: ZotzLinkContext
): Promise<void> {
  const groups = useAppStore.getState().settings?.zotzConversationLinks ?? []
  return commitZotzLinks(
    linkZotzMembers(groups, a, b, Date.now(), createNonSecureContextUuid),
    context
  )
}

export function unlinkZotzConversation(
  member: ZotzLinkMember,
  context: ZotzLinkContext,
  /** Its children in the same group leave with it. */
  followers: readonly ZotzLinkMember[] = []
): Promise<void> {
  const groups = currentGroups()
  const own = findZotzLinkGroup(groups, member)
  const leaving = [
    member,
    ...followers.filter((f) => own !== null && findZotzLinkGroup(groups, f)?.id === own.id)
  ]
  return commitZotzLinks(
    leaving.reduce((next, m) => unlinkZotzMember(next, m), groups),
    context
  )
}

function currentGroups(): ZotzLinkGroup[] {
  return useAppStore.getState().settings?.zotzConversationLinks ?? []
}

/** Creates an empty named group; returns its id. */
export async function createZotzGroupNamed(name: string): Promise<string> {
  const id = createNonSecureContextUuid()
  await useAppStore.getState().updateSettings({
    zotzConversationLinks: createZotzGroup(currentGroups(), name, Date.now(), id)
  })
  return id
}

export function renameZotzGroupNamed(id: string, name: string): Promise<void> {
  return useAppStore
    .getState()
    .updateSettings({ zotzConversationLinks: renameZotzGroup(currentGroups(), id, name) })
}

export function reorderZotzGroupTo(id: string, index: number): Promise<void> {
  return useAppStore
    .getState()
    .updateSettings({ zotzConversationLinks: reorderZotzGroup(currentGroups(), id, index) })
}

export function deleteZotzGroup(id: string, context: ZotzLinkContext): Promise<void> {
  return commitZotzLinks(removeZotzGroup(currentGroups(), id), context)
}

/** False when the group would hold two servers (they can't write to each other). */
export async function moveZotzConversationToGroup(
  member: ZotzLinkMember,
  groupId: string,
  context: ZotzLinkContext,
  index?: number,
  /** Its children, placed right after it. */
  followers: readonly ZotzLinkMember[] = []
): Promise<boolean> {
  let next: ZotzLinkGroup[] | null = currentGroups()
  for (const [offset, moving] of [member, ...followers].entries()) {
    next =
      next &&
      moveZotzMemberToGroup(next, moving, groupId, index === undefined ? undefined : index + offset)
  }
  if (!next) {
    toast.error(
      translate(
        'zotz.groups.twoServers',
        "Two servers can't write to each other, so a group holds this machine and at most one server."
      )
    )
    return false
  }
  await commitZotzLinks(next, context)
  return true
}
