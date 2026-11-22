import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { ZotzLinkSetPeersParams } from '../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import { splitWorktreeIdForFilesystem } from '../../../shared/worktree/id'
import {
  formatOrcaSessionAddress,
  isOrcaSessionId
} from '../../../shared/agent-session/identity/orca-session-address'
import { canonicalOrcaSessionId } from '../../runtime/orchestration/addressing/session-lineage/canonical-orca-session-id'
import { runtimePathsEqual } from '../../runtime/workspaces/catalog/runtime-worktree-path-identity'
import { listZotzHostConversations } from './zotz-host-conversations'
import { getZotzLinkPeerStore } from './zotz-link-peer-store'
import {
  buildZotzLinkNotice,
  deliverZotzLinkNotice,
  getZotzLinkNoticeRuntime,
  zotzLinkNoticeId
} from './zotz-link-notice'

/** Stores one worktree's partners and tells its live chats; an unchanged list tells nobody again. */
export async function setZotzLinkPeers(
  runtime: OrcaRuntimeService,
  { path, peers }: ZotzLinkSetPeersParams
): Promise<{ ok: true }> {
  const change = await getZotzLinkPeerStore().set(path, peers)
  if (!change.changed) {
    return { ok: true }
  }
  const conversation = (await listZotzHostConversations(runtime)).find((candidate) =>
    runtimePathsEqual(candidate.path, path)
  )
  const changedAt = change.current?.changedAt ?? Date.now()
  const notice = buildZotzLinkNotice(peers, change.previous?.peers)
  for (const chat of conversation?.chats ?? []) {
    deliverZotzLinkNotice(runtime, {
      id: zotzLinkNoticeId(chat.sessionId, changedAt),
      to: chat.address,
      ...notice
    })
  }
  return { ok: true }
}

/** A chat that starts (or restarts after /clear) in a linked worktree learns its partners once per session. */
export function announceZotzLinksOnChatStart(record: AgentSessionRecord | null): void {
  void announce(record).catch((error: unknown) => {
    console.warn('[zotz] failed to announce links to a starting chat', error)
  })
}

async function announce(record: AgentSessionRecord | null): Promise<void> {
  const runtime = getZotzLinkNoticeRuntime()
  if (
    !runtime ||
    !record ||
    record.location.executionHostId !== LOCAL_EXECUTION_HOST_ID ||
    !isOrcaSessionId(record.sessionId)
  ) {
    return
  }
  const path = splitWorktreeIdForFilesystem(record.location.workspaceId)?.worktreePath
  const entry = path ? await getZotzLinkPeerStore().get(path) : null
  if (!path || !entry) {
    return
  }
  deliverZotzLinkNotice(runtime, {
    id: zotzLinkNoticeId(record.sessionId, entry.changedAt),
    to: formatOrcaSessionAddress(canonicalOrcaSessionId(record.sessionId)),
    ...buildZotzLinkNotice(entry.peers)
  })
}
