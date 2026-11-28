// `/flow` and each flow's own shortcut in the chat composer (spec §6): Zotz runs them, the agent never sees them.

import type { ZotzFlow } from './zotz-flow-contract'
import type { ZotzFlowChatContext } from './zotz-flow-run-contract'
import type { ZotzFlowTrigger } from './zotz-flow-trigger-contract'

export const ZOTZ_FLOW_CHAT_COMMAND = 'flow'

// Same bound as `ZotzFlowChatContextSchema`; longer text is cut so the run is never refused.
const MAX_CONTEXT_TEXT = 200_000
const MAX_ATTACHMENTS = 50

export type ZotzFlowChatTrigger = Extract<ZotzFlowTrigger, { kind: 'chat_command' }>

/** A flow a chat can fire, with the machine that stores and runs it. */
export type ZotzFlowChatEntry<TMachine> = {
  machine: TMachine
  flow: ZotzFlow
  trigger: ZotzFlowChatTrigger
}

/** Enabled flows with a chat command trigger; a flow that is off refuses chat runs. */
export function zotzFlowChatEntries<TMachine>(
  machine: TMachine,
  flows: readonly ZotzFlow[]
): ZotzFlowChatEntry<TMachine>[] {
  return flows.flatMap((flow) => {
    const trigger = flow.enabled
      ? flow.triggers.find((entry) => entry.kind === 'chat_command')
      : undefined
    return trigger?.kind === 'chat_command' ? [{ machine, flow, trigger }] : []
  })
}

/**
 * Shortcut name to the entries that claim it, first one wins. An agent command or skill of the
 * same name keeps it, and the flow stays reachable through `/flow <slug>` only (spec §6.1).
 */
export function zotzFlowChatShortcuts<TMachine>(
  entries: readonly ZotzFlowChatEntry<TMachine>[],
  takenNames: Iterable<string>
): Map<string, ZotzFlowChatEntry<TMachine>> {
  const taken = new Set([ZOTZ_FLOW_CHAT_COMMAND, ...[...takenNames].map((n) => n.toLowerCase())])
  const shortcuts = new Map<string, ZotzFlowChatEntry<TMachine>>()
  for (const entry of entries) {
    const name = entry.trigger.command
    if (name && !taken.has(name) && !shortcuts.has(name)) {
      shortcuts.set(name, entry)
    }
  }
  return shortcuts
}

export type ZotzFlowChatDraft =
  /** `/flow` alone: choose a flow from the menu. */
  | { kind: 'menu'; text: string }
  | { kind: 'slug'; slug: string; text: string }
  | { kind: 'shortcut'; name: string; text: string }

/** `/flow [slug] [text]` or `/<shortcut> [text]` as the whole message; null for anything else. */
export function parseZotzFlowChatDraft(
  draft: string,
  shortcuts: ReadonlySet<string> | ReadonlyMap<string, unknown>
): ZotzFlowChatDraft | null {
  const match = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\s+([\s\S]*))?$/i.exec(draft.trim())
  if (!match) {
    return null
  }
  const name = match[1].toLowerCase()
  const rest = match[2]?.trim() ?? ''
  if (name === ZOTZ_FLOW_CHAT_COMMAND) {
    const slug = /^(\S+)(?:\s+([\s\S]*))?$/.exec(rest)
    return slug
      ? { kind: 'slug', slug: slug[1].toLowerCase(), text: slug[2]?.trim() ?? '' }
      : { kind: 'menu', text: '' }
  }
  return shortcuts.has(name) ? { kind: 'shortcut', name, text: rest } : null
}

/** An agent step in the chat's workspace needs it even when the trigger did not ask for it. */
export function zotzFlowNeedsChatWorkspace(flow: ZotzFlow): boolean {
  return flow.nodes.some((node) => node.kind === 'agent' && node.workspaceSource === 'chat')
}

export type ZotzFlowChatSource = {
  text: string
  /** Oldest first; user and agent turns only. */
  messages: readonly { role: 'user' | 'assistant'; text: string; at: number | null }[]
  attachments: readonly { name: string; path: string; mimeType?: string }[]
  workspace: { id: string; name: string | null; path: string | null } | null
  repo: string | null
  branch: string | null
  agent: string | null
  sessionId: string
}

function bounded(text: string): string {
  return text.length > MAX_CONTEXT_TEXT ? text.slice(0, MAX_CONTEXT_TEXT) : text
}

/**
 * Only what the trigger asks for goes to the flow (spec §6.2). The chat's id always goes: the
 * flow's card, "run in this chat" and the chat reply step address the chat by it.
 */
export function buildZotzFlowChatContext(
  flow: ZotzFlow,
  trigger: ZotzFlowChatTrigger,
  source: ZotzFlowChatSource
): ZotzFlowChatContext {
  const request = trigger.context
  const context: ZotzFlowChatContext = { text: bounded(source.text), sessionId: source.sessionId }
  if (request.lastAnswer) {
    const last = source.messages.findLast(
      (message) => message.role === 'assistant' && message.text.trim() !== ''
    )
    context.lastAnswer = bounded(last?.text ?? '')
  }
  if (request.transcript) {
    context.transcript = source.messages
      .filter((message) => message.text.trim() !== '')
      .slice(-request.transcriptMessages)
      .map((message) => ({
        role: message.role,
        text: bounded(message.text),
        ...(message.at === null ? {} : { at: message.at })
      }))
  }
  if (request.attachments) {
    context.attachments = source.attachments.slice(0, MAX_ATTACHMENTS)
  }
  if (request.session || zotzFlowNeedsChatWorkspace(flow)) {
    context.workspace = source.workspace
  }
  if (request.session) {
    context.repo = source.repo
    context.branch = source.branch
    context.agent = source.agent
  }
  return context
}
