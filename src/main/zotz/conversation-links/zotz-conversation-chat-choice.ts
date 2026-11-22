import type {
  ZotzConversationEntry,
  ZotzConversationState
} from '../../../shared/zotz/conversation-links/zotz-conversation-links-contract'

/** One live agent chat in a conversation's worktree. */
export type ZotzConversationChat = {
  sessionId: string
  /** `orca_session_id:<root>`: the /clear root keeps the address stable across sessions. */
  address: string
  agent: string
  state: ZotzConversationState
  /** Its tab is the worktree's active tab. */
  active: boolean
  lastFocusedAt: number
}

export type ZotzHostConversation = Omit<ZotzConversationEntry, 'agent' | 'state' | 'address'> & {
  archived: boolean
  chats: ZotzConversationChat[]
}

export type ZotzConversationChatChoice =
  | { kind: 'one'; chat: ZotzConversationChat }
  | { kind: 'ambiguous'; chats: ZotzConversationChat[] }
  | { kind: 'none' }

/** The chat mail to a conversation reaches: its only one, or the one in the active tab. */
export function chooseZotzConversationChat(
  chats: readonly ZotzConversationChat[]
): ZotzConversationChatChoice {
  if (chats.length === 0) {
    return { kind: 'none' }
  }
  if (chats.length === 1) {
    return { kind: 'one', chat: chats[0] }
  }
  const active = chats.filter((chat) => chat.active)
  return active.length === 1
    ? { kind: 'one', chat: active[0] }
    : { kind: 'ambiguous', chats: [...chats] }
}

/** What a listing shows: the chosen chat, or the most recently focused one when none is chosen. */
export function displayedZotzConversationChat(
  chats: readonly ZotzConversationChat[]
): ZotzConversationChat | null {
  const choice = chooseZotzConversationChat(chats)
  if (choice.kind === 'one') {
    return choice.chat
  }
  if (choice.kind === 'none') {
    return null
  }
  return choice.chats.reduce((best, chat) =>
    chat.lastFocusedAt > best.lastFocusedAt ? chat : best
  )
}

export function toZotzConversationEntry(conversation: ZotzHostConversation): ZotzConversationEntry {
  const chat = displayedZotzConversationChat(conversation.chats)
  return {
    worktreeId: conversation.worktreeId,
    path: conversation.path,
    shortName: conversation.shortName,
    title: conversation.title,
    projectName: conversation.projectName,
    agent: chat?.agent ?? null,
    state: chat?.state ?? null,
    address: chat?.address ?? null
  }
}
