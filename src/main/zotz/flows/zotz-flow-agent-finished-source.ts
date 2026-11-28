import { basename } from 'node:path'
import type { AgentStatusIpcPayload } from '../../../shared/agent-status/contracts/agent-status-ipc-payload'
import { agentMainAgentVerdict } from '../../../shared/agent-status/lifecycle/agent-main-agent-verdict'
import type { AgentTurnOutcome } from '../../../shared/agent-status/lifecycle/agent-turn-outcome'
import { mainAgentDoneAt } from '../../../shared/agent-status/lifecycle/main-agent-status'
import type { AgentSessionTurnCompletion } from '../../../shared/agent-session/view/agent-session-turn-completion-wire'
import { latestStructuredAgentSessionAssistantMessage } from '../../../shared/agent-session/requests/structured-agent-session-latest-request'
import type { NativeChatMessage } from '../../../shared/native-chat/native-chat-types'
import { parseWorkspaceKey } from '../../../shared/workspace/identity/workspace-scope'
import { getRepoIdFromWorktreeId, splitWorktreeId } from '../../../shared/worktree/id'
import type { AgentPaneChange } from '../../agent-hooks/observations/agent-transition-detector'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'
import { getStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { readNativeChatTranscriptTail } from '../../native-chat/transcript-tail-reader'
import type { RuntimeStore } from '../../runtime/construction/runtime-store-contract'
import { sessionCrewChanges } from '../../runtime/orchestration/crew/crew-changes'
import {
  TerminalAgentTurnNews,
  type TerminalAgentTurnNewsItem
} from '../../runtime/push/notifications/terminal-agent-turn-news'
import type { ZotzFlowEventDispatcher } from './zotz-flow-event-dispatch'
import type { ZotzFlowOriginMark, ZotzFlowOriginTarget } from './zotz-flow-origin'
import { zotzFlowAgentFinishedMatches, zotzFlowAgentOutcome } from './zotz-flow-trigger-match'

// Same bound the chat context uses for one message.
const MAX_LAST_MESSAGE = 200_000
const TRANSCRIPT_TAIL_MESSAGES = 30
const CHAT_HISTORY_TAIL_ITEMS = 60
const SUBSCRIBER_ID = 'zotz-flow-agent-finished'

type WorkspaceStore = Pick<RuntimeStore, 'getRepo' | 'getWorktreeMeta' | 'getFolderWorkspaces'>

export type ZotzFlowAgentFinishedDeps = {
  dispatcher: ZotzFlowEventDispatcher
  store: WorkspaceStore
  findOrigin: (target: ZotzFlowOriginTarget) => ZotzFlowOriginMark | null
  /** Hook-reported terminal agents (runtime.agentTransitions). */
  transitions: {
    subscribe: (listener: (change: AgentPaneChange) => void) => () => void
    latestRow: (paneKey: string) => AgentStatusIpcPayload | null
  }
  getAcceptedReply: (paneKey: string, leadTurnKey: number) => string | undefined
}

type WorkspaceFacts = {
  workspace: { id: string; name: string | null; path: string | null; branch: string | null }
  project: (string | null)[]
}

function workspaceFacts(store: WorkspaceStore, workspaceId: string): WorkspaceFacts {
  const scope = parseWorkspaceKey(workspaceId)
  if (scope?.type === 'folder') {
    const folder = store
      .getFolderWorkspaces?.()
      .find((entry) => entry.id === scope.folderWorkspaceId)
    return {
      workspace: {
        id: workspaceId,
        name: folder?.name ?? null,
        path: folder?.folderPath ?? null,
        branch: null
      },
      project: [scope.folderWorkspaceId, folder?.name ?? null]
    }
  }
  const worktreeId = scope?.type === 'worktree' ? scope.worktreeId : workspaceId
  const repoId = getRepoIdFromWorktreeId(worktreeId)
  const path = splitWorktreeId(worktreeId)?.worktreePath ?? null
  return {
    workspace: {
      id: worktreeId,
      name: store.getWorktreeMeta(worktreeId)?.displayName || (path ? basename(path) : null),
      path,
      branch: null
    },
    project: [repoId, store.getRepo(repoId)?.displayName ?? null]
  }
}

function bounded(text: string): string {
  return text.length > MAX_LAST_MESSAGE ? text.slice(-MAX_LAST_MESSAGE) : text
}

function lastAssistantText(messages: readonly NativeChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message?.role !== 'assistant') {
      continue
    }
    const text = message.blocks
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
    if (text.trim()) {
      return text
    }
  }
  return ''
}

/** The full accepted reply, else the agent's transcript, else the status preview. */
async function terminalLastMessage(
  deps: ZotzFlowAgentFinishedDeps,
  paneKey: string,
  row: AgentStatusIpcPayload
): Promise<string> {
  const turnKey = mainAgentDoneAt(row)
  const accepted = turnKey === undefined ? undefined : deps.getAcceptedReply(paneKey, turnKey)
  if (accepted?.trim()) {
    return accepted
  }
  const session = row.providerSession
  // Transcripts of SSH agents live on that host; their preview is all this machine has.
  if (session && row.agentType && !row.connectionId) {
    const tail = await readNativeChatTranscriptTail({
      agent: row.agentType,
      sessionId: session.id,
      ...(session.transcriptPath ? { transcriptPath: session.transcriptPath } : {}),
      ...(session.cwd ? { cwd: session.cwd } : {}),
      limit: TRANSCRIPT_TAIL_MESSAGES
    }).catch(() => null)
    const text = tail && 'messages' in tail ? lastAssistantText(tail.messages) : ''
    if (text.trim()) {
      return text
    }
  }
  return row.lastAssistantMessageIsToolOutput ? '' : (row.lastAssistantMessage ?? '')
}

async function chatLastMessage(host: StructuredAgentSessionHost, sessionId: string) {
  const history = await host
    .history({ sessionId, direction: 'tail', limit: CHAT_HISTORY_TAIL_ITEMS })
    .catch(() => null)
  const text = history?.ok ? latestStructuredAgentSessionAssistantMessage(history.page.items) : ''
  return text.trim() ? text : (host.readStatusSummary(sessionId)?.lastAssistantMessage ?? '')
}

/**
 * "Agent finished" (spec §4.2): terminal agents through their status hooks, chats through the
 * structured host's turn completions. Each event carries the session that finished, so the
 * engine refuses it for the flow that launched that agent.
 */
export function watchZotzFlowAgentFinished(deps: ZotzFlowAgentFinishedDeps): () => void {
  // The turn last announced per pane: a stopped turn is told by both news callbacks.
  const announced = new Map<string, number>()

  const handle = async (input: {
    agentId: string
    sessionId: string | null
    title: string | null
    workspaceId: string
    verdict: AgentTurnOutcome | null
    origin: ZotzFlowOriginTarget
    lastMessage: () => Promise<string>
  }): Promise<void> => {
    const facts = workspaceFacts(deps.store, input.workspaceId)
    const outcome = zotzFlowAgentOutcome(input.verdict)
    const accepts = (trigger: Parameters<typeof zotzFlowAgentFinishedMatches>[0]) =>
      zotzFlowAgentFinishedMatches(trigger, {
        agentId: input.agentId,
        outcome,
        project: facts.project,
        workspace: [facts.workspace.id, facts.workspace.name, facts.workspace.path]
      })
    if (!deps.dispatcher.matches('agent_finished', accepts)) {
      return
    }
    // Read before the message so a flow-launched agent is known even if its run is pruned meanwhile.
    const causedBy = deps.findOrigin(input.origin)
    const lastMessage = bounded(await input.lastMessage().catch(() => ''))
    deps.dispatcher.fire(
      'agent_finished',
      {
        kind: 'agent_finished',
        agent: { agentId: input.agentId, sessionId: input.sessionId, title: input.title },
        workspace: facts.workspace,
        lastMessage,
        outcome
      },
      accepts,
      causedBy
    )
  }

  const onTerminalFinish = (item: TerminalAgentTurnNewsItem, verdict: AgentTurnOutcome | null) => {
    const { paneKey, worktreeId, row } = item
    // Needs-input news and session boundaries are not finished turns.
    if (row.state !== 'done' || row.sessionBoundary === true) {
      return
    }
    if (announced.get(paneKey) === row.stateStartedAt) {
      return
    }
    announced.set(paneKey, row.stateStartedAt)
    void handle({
      agentId: row.agentType ?? 'unknown',
      sessionId: row.providerSession?.id ?? null,
      title: row.orchestration?.displayName ?? row.orchestration?.taskTitle ?? null,
      workspaceId: worktreeId,
      verdict,
      origin: { terminalPaneKey: paneKey, workspaceId: worktreeId },
      lastMessage: () => terminalLastMessage(deps, paneKey, row)
    })
  }

  const news = new TerminalAgentTurnNews<TerminalAgentTurnNewsItem>({
    readHookRow: (paneKey) => deps.transitions.latestRow(paneKey),
    prepare: (item) => item,
    deliver: (item) => onTerminalFinish(item, agentMainAgentVerdict(item.row)),
    stopped: (item) => onTerminalFinish(item, 'cancellation'),
    setTimer: (run, delayMs) => {
      const timer = setTimeout(run, delayMs)
      timer.unref?.()
      return { cancel: () => clearTimeout(timer) }
    }
  })
  const stopTerminal = deps.transitions.subscribe((change) => news.observe(change))

  const onChatCompletion = (host: StructuredAgentSessionHost, done: AgentSessionTurnCompletion) => {
    // A turn that stopped on a question is waiting for the user, not finished.
    if (done.awaitingUser) {
      return
    }
    const record = host.deps.store.getConversation(done.sessionId)
    void handle({
      agentId: host.readStatusSummary(done.sessionId)?.agent ?? record?.provider ?? 'unknown',
      sessionId: done.sessionId,
      title: record?.conversationName ?? null,
      workspaceId: done.scope.workspaceId,
      verdict: done.outcome,
      origin: { chatSessionId: done.sessionId, workspaceId: done.scope.workspaceId },
      lastMessage: () => chatLastMessage(host, done.sessionId)
    })
  }

  // The chat host installs lazily (first chat) and can be replaced; follow whichever is current.
  let host: StructuredAgentSessionHost | null = null
  let stopChat: (() => void) | null = null
  const followHost = (): void => {
    const next = getStructuredAgentSessionHost()
    if (next === host) {
      return
    }
    stopChat?.()
    host = next
    stopChat =
      next?.subscribeTurnCompletions({
        id: SUBSCRIBER_ID,
        emit: (event) => {
          if (event.type === 'completion') {
            onChatCompletion(next, event.completion)
          }
        }
      }) ?? null
  }
  followHost()
  const stopFollowing = sessionCrewChanges.subscribe(followHost)

  return () => {
    stopFollowing()
    stopChat?.()
    stopTerminal()
    news.dispose()
    announced.clear()
  }
}
