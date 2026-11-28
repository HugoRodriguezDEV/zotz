import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { findWorktreeById } from '@/store/github/refresh/worktree-refresh'
import type { NativeChatMessage } from '../../../../../shared/native-chat/native-chat-types'
import { deriveNativeChatRowContent } from '../../../../../shared/native-chat/transcript/row-content/native-chat-row-content'
import { projectNativeChatTranscriptMessages } from '../../../../../shared/native-chat/transcript/native-chat-transcript-projection'
import {
  compareNativeChatDisplayMessages,
  orderNativeChatDisplayMessages
} from '../../../../../shared/native-chat/transcript/messages/native-chat-message-order'
import {
  buildZotzFlowChatContext,
  type ZotzFlowChatSource
} from '../../../../../shared/zotz/flows/zotz-flow-chat-command'
import type { ZotzFlowInputValues } from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import { readNativeChatComposerDraft } from '@/components/native-chat/drafts/native-chat-composer-draft-store'
import { zotzFlowChatRpc } from './zotz-flow-chat-rpc'
import { upsertZotzFlowChatRun, type ZotzFlowChatMachineEntry } from './zotz-flow-chat-store'

/** The chat a command was typed in; what its flow may read (spec §6.2). */
export type ZotzFlowChatOrigin = {
  sessionId: string
  agent: string
  worktreeId: string | undefined
  draftScopeKey: string
}

// The open chat's transcript, read only when a command runs so streaming never re-renders here.
const transcripts = new Map<string, () => readonly NativeChatMessage[]>()

export function registerZotzFlowChatTranscript(
  sessionId: string,
  read: () => readonly NativeChatMessage[]
): () => void {
  transcripts.set(sessionId, read)
  return () => {
    if (transcripts.get(sessionId) === read) {
      transcripts.delete(sessionId)
    }
  }
}

function transcriptOf(sessionId: string): ZotzFlowChatSource['messages'] {
  const messages = transcripts.get(sessionId)?.() ?? []
  return projectNativeChatTranscriptMessages(
    messages,
    compareNativeChatDisplayMessages,
    orderNativeChatDisplayMessages
  ).flatMap((message) =>
    (message.role === 'user' || message.role === 'assistant') && !message.agentStart
      ? [
          {
            role: message.role,
            text: deriveNativeChatRowContent(message.blocks).markdown,
            at: message.timestamp
          }
        ]
      : []
  )
}

function fileName(path: string): string {
  return path.split(/[\\/]/).findLast(Boolean) ?? path
}

function sourceOf(origin: ZotzFlowChatOrigin, text: string): ZotzFlowChatSource {
  const state = useAppStore.getState()
  const worktree = origin.worktreeId ? findWorktreeById(state, origin.worktreeId) : null
  const repo = worktree ? state.repos.find((entry) => entry.id === worktree.repoId) : undefined
  // Folder workspaces have no repo or branch (AGENTS.md: not every workspace is a git worktree).
  const git = repo !== undefined && repo.kind !== 'folder'
  const branch = git && worktree?.branch ? worktree.branch.replace(/^refs\/heads\//, '') : null
  return {
    text,
    messages: transcriptOf(origin.sessionId),
    attachments: readNativeChatComposerDraft(origin.draftScopeKey)
      .images.filter((image) => image.path !== '')
      .map((image) => ({ name: fileName(image.path), path: image.path })),
    workspace: worktree
      ? { id: worktree.id, name: worktree.displayName || null, path: worktree.path || null }
      : null,
    repo: git ? repo.displayName : null,
    branch,
    agent: origin.agent,
    sessionId: origin.sessionId
  }
}

/** Runs the flow on its machine with the chat's context; the card appears from the result. */
export async function runZotzFlowFromChat(
  entry: ZotzFlowChatMachineEntry,
  origin: ZotzFlowChatOrigin,
  text: string,
  inputs: ZotzFlowInputValues
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { run } = await zotzFlowChatRpc.run(entry.machine, {
      id: entry.flow.id,
      triggerId: entry.trigger.id,
      text,
      inputs,
      chat: buildZotzFlowChatContext(entry.flow, entry.trigger, sourceOf(origin, text))
    })
    upsertZotzFlowChatRun(origin.sessionId, entry.machine, run)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: translate('zotz.flowChat.runFailed', 'Could not run {{flow}}: {{error}}', {
        flow: entry.flow.name,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
}
