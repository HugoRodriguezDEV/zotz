import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { ZotzConversationState } from '../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { AgentStatusState } from '../../../shared/agent-status/contracts/agent-status-types'
import type { AgentSessionLastTurn } from '../../../shared/agent-session/lifecycle/records/agent-session-last-turn'
import type { WorkspaceSessionState } from '../../../shared/workspace-session/workspace-session-state-types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import { composeWorktreeHostIdentity } from '../../../shared/worktree/host-qualified-identity'
import { structuredAgentSessionTabId } from '../../../shared/agent-session/view/structured-agent-session-projection'
import {
  formatOrcaSessionAddress,
  isOrcaSessionId
} from '../../../shared/agent-session/identity/orca-session-address'
import { resolveZotzShortNames } from '../../../shared/zotz/zotz-short-name'
import {
  createReferenceAgentIndex,
  referenceConnectionHosts
} from '../../runtime/workspaces/references/runtime-reference-agents'
import { conversationRecordReader } from '../../runtime/orchestration/addressing/session-lineage/structured-session-lineage'
import { createCanonicalOrcaSessionResolver } from '../../runtime/orchestration/addressing/session-lineage/canonical-orca-session-id'
import { isZotzUserConversation } from '../../../shared/zotz/zotz-user-conversation'
import { getZotzShortNameStore } from '../zotz-short-name-store'
import type { ZotzConversationChat, ZotzHostConversation } from './zotz-conversation-chat-choice'

const FLEET_STATES: Record<AgentStatusState, ZotzConversationState> = {
  working: 'working',
  blocked: 'waiting',
  waiting: 'waiting',
  done: 'done'
}

function lastTurnState(turn: AgentSessionLastTurn | undefined): ZotzConversationState {
  return turn?.state === 'open' ? 'working' : turn?.state === 'settled' ? 'done' : 'idle'
}

/** Ids of the worktree's active tab, in its focused group. */
function activeTabIds(session: WorkspaceSessionState | undefined, worktreeId: string): Set<string> {
  const ids = new Set<string>()
  const groups = session?.tabGroups?.[worktreeId] ?? []
  const focused = session?.activeGroupIdByWorktree?.[worktreeId]
  const group = groups.find((candidate) => candidate.id === focused) ?? groups[0]
  const tabId = group?.activeTabId
  if (!tabId) {
    return ids
  }
  ids.add(tabId)
  const tab = session?.unifiedTabs?.[worktreeId]?.find((candidate) => candidate.id === tabId)
  if (tab) {
    ids.add(tab.entityId)
  }
  return ids
}

function tabFocusedAt(
  session: WorkspaceSessionState | undefined,
  worktreeId: string,
  tabIds: readonly string[]
): number {
  const tab = session?.unifiedTabs?.[worktreeId]?.find(
    (candidate) => tabIds.includes(candidate.id) || tabIds.includes(candidate.entityId)
  )
  return tab?.lastFocusedAt ?? tab?.createdAt ?? 0
}

function readOrchestrationDb(runtime: OrcaRuntimeService) {
  try {
    return runtime.getExistingOrchestrationDb()
  } catch {
    return null
  }
}

/** Every conversation (worktree, hidden ones too) on this host, with the live agent chats that can take mail. */
export async function listZotzHostConversations(
  runtime: OrcaRuntimeService
): Promise<ZotzHostConversation[]> {
  const repos = runtime.listRepos()
  const projectNames = new Map(repos.map((repo) => [repo.id, repo.displayName]))
  const { worktrees } = await runtime.listManagedWorktrees(undefined, Number.MAX_SAFE_INTEGER)
  const local = worktrees.filter(
    (row) => (row.hostId ?? LOCAL_EXECUTION_HOST_ID) === LOCAL_EXECUTION_HOST_ID
  )
  const shortNames = resolveZotzShortNames(
    local.map((row) => row.path),
    await getZotzShortNameStore().list()
  )
  const store = await runtime.openAgentSessionRecordStore()
  const records = conversationRecordReader(store)
  const rootOf = createCanonicalOrcaSessionResolver(records)
  const keys = new Set(
    local.map((row) => composeWorktreeHostIdentity(LOCAL_EXECUTION_HOST_ID, row.id))
  )
  const index = createReferenceAgentIndex(
    runtime,
    readOrchestrationDb(runtime),
    records,
    keys,
    referenceConnectionHosts(repos)
  )
  const fleet = new Map<string, { state: AgentStatusState; at: number }>()
  for (const { activity, deliveredAt } of runtime.getOrchestrationFleetAgentStatusSnapshot()) {
    const previous = fleet.get(activity.paneKey)
    if (!activity.connectionId && (!previous || deliveredAt > previous.at)) {
      fleet.set(activity.paneKey, { state: activity.state, at: deliveredAt })
    }
  }
  let session: WorkspaceSessionState | undefined
  try {
    session = runtime.requireStore().getWorkspaceSession?.()
  } catch {
    session = undefined
  }

  return local.map((row) => {
    const active = activeTabIds(session, row.id)
    const chats: ZotzConversationChat[] = []
    for (const candidate of index.get(
      composeWorktreeHostIdentity(LOCAL_EXECUTION_HOST_ID, row.id)
    ) ?? []) {
      const sessionId = candidate.sessionId
      if (!sessionId || !candidate.mailbox || !isOrcaSessionId(sessionId)) {
        continue
      }
      const tabIds = [
        store.getSessionTabId(sessionId),
        structuredAgentSessionTabId(sessionId)
      ].filter((id): id is string => Boolean(id))
      const fleetState = candidate.paneKey ? fleet.get(candidate.paneKey)?.state : undefined
      chats.push({
        sessionId,
        address: formatOrcaSessionAddress(rootOf(sessionId)),
        agent: candidate.agent ?? 'agent',
        state: fleetState
          ? FLEET_STATES[fleetState]
          : lastTurnState(records.getRecord(sessionId)?.lastTurn),
        active: tabIds.some((id) => active.has(id)),
        lastFocusedAt: tabFocusedAt(session, row.id, tabIds)
      })
    }
    return {
      worktreeId: row.id,
      path: row.path,
      shortName: shortNames.get(row.path) ?? '',
      // Same title the sidebar row shows.
      title: row.displayName || row.branch.replace(/^refs\/heads\//, '') || row.path,
      projectName: projectNames.get(row.repoId) ?? '',
      parentWorktreeId: row.cliProvenance?.zotzParentWorktreeId ?? null,
      listed: isZotzUserConversation(row, chats.length > 0 ? new Set([row.id]) : new Set()),
      chats
    }
  })
}
