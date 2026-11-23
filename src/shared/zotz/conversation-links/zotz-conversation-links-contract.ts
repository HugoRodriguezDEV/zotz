import type { ExecutionHostId } from '../../execution-host'

/** Hosts that answer `zotz.conversations.list`. */
export const ZOTZ_CONVERSATIONS_RUNTIME_CAPABILITY = 'zotz.conversations.v1'
/** Hosts that answer `zotz.links.setPeers` and `zotz.links.messages`, and resolve `wt:` recipients. */
export const ZOTZ_LINKS_RUNTIME_CAPABILITY = 'zotz.links.v1'

/** Prefix that addresses a conversation by its short name on the sender's own machine. */
export const ZOTZ_SHORT_NAME_RECIPIENT_PREFIX = 'wt:'

export type ZotzConversationState = 'working' | 'waiting' | 'done' | 'idle'

/** One conversation (a worktree with or without a live agent chat) on the host that answers. */
export type ZotzConversationEntry = {
  worktreeId: string
  /** Worktree path on that host; the stable key links and short names use. */
  path: string
  shortName: string
  title: string
  projectName: string
  /** Agent kind of its live chat (claude, codex…), null without one. */
  agent: string | null
  state: ZotzConversationState | null
  /** `orca_session_id:<root>` of its live chat, null when none is reachable. */
  address: string | null
}

export type ZotzConversationsListResult = {
  conversations: ZotzConversationEntry[]
}

/**
 * A linked partner, described from the receiving conversation's machine:
 * `direct` = same machine (`--to wt:<shortName>`), `on-server` = a paired server it can write to
 * (`--to wt:<shortName> --on "<machine>"`), `reply-only` = the laptop that paired this server;
 * servers cannot start mail to it, so the agent answers with `orchestration reply`.
 */
export type ZotzLinkPeer = {
  shortName: string
  title: string
  /** Display name of the partner's machine; null when it is the same machine. */
  machine: string | null
  reach: 'direct' | 'on-server' | 'reply-only'
}

/** Params of `zotz.links.setPeers`: the partners of one conversation on the answering host. */
export type ZotzLinkSetPeersParams = {
  path: string
  /** Empty unlinks it: the host forgets the peers and tells the agent the link ended. */
  peers: ZotzLinkPeer[]
}

export type ZotzLinkMessage = {
  id: string
  from: string
  to: string
  /** Readable sender when mail came from another machine (`<address> on <machine>`). */
  fromLabel: string | null
  subject: string
  body: string
  type: string
  createdAt: number
}

/** Params of `zotz.links.messages`: mail on that host whose sender and recipient are both listed. */
export type ZotzLinkMessagesParams = {
  addresses: string[]
  limit?: number
}

export type ZotzLinkMessagesResult = {
  messages: ZotzLinkMessage[]
}

/** One link group as the UI's machine stores it (GlobalSettings.zotzConversationLinks). */
export type ZotzLinkGroup = {
  id: string
  /** Members by machine (from this machine's point of view) and worktree path. */
  members: { hostId: ExecutionHostId; path: string }[]
  createdAt: number
  /** Named groups show in the sidebar and survive with one member or none; links made before groups have none. */
  name?: string
  /** Sidebar position among groups, lowest first. */
  order?: number
}
