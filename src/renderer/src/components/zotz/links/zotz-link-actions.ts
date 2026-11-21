import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import { toast } from 'sonner'
import { useAppStore } from '@/store/index'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { translate } from '@/i18n/i18n'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import type {
  ZotzConversationEntry,
  ZotzLinkGroup,
  ZotzLinkSetPeersParams
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { ZotzLinkHost } from './use-zotz-link-data'
import {
  findZotzLinkGroup,
  linkZotzMembers,
  sameZotzLinkMember,
  unlinkZotzMember,
  zotzLinkPeersFor,
  type ZotzLinkMember
} from './zotz-link-groups'

export type ZotzLinkContext = {
  hosts: readonly ZotzLinkHost[]
  entryFor: (member: ZotzLinkMember) => ZotzConversationEntry | null
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
async function commitZotzLinks(next: ZotzLinkGroup[], context: ZotzLinkContext): Promise<void> {
  const state = useAppStore.getState()
  const prev = state.settings?.zotzConversationLinks ?? []
  await state.updateSettings({ zotzConversationLinks: next })
  const machineName = (hostId: ExecutionHostId): string =>
    context.hosts.find((h) => h.hostId === hostId)?.name ?? hostId
  const describe = (member: ZotzLinkMember) => {
    const entry = context.entryFor(member)
    return {
      shortName: entry?.shortName ?? basename(member.path),
      title: entry?.title ?? basename(member.path)
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
  context: ZotzLinkContext
): Promise<void> {
  const groups = useAppStore.getState().settings?.zotzConversationLinks ?? []
  return commitZotzLinks(unlinkZotzMember(groups, member), context)
}
