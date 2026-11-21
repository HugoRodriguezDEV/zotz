import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { OrchestrationError } from '../../runtime/orchestration/orchestration-error'
import { ZOTZ_SHORT_NAME_RECIPIENT_PREFIX } from '../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { normalizeZotzShortName } from '../../../shared/zotz/zotz-short-name'
import { ZOTZ_CLI_COMMAND } from '../../../shared/zotz/zotz-app-identity'
import {
  chooseZotzConversationChat,
  type ZotzHostConversation
} from './zotz-conversation-chat-choice'
import { listZotzHostConversations } from './zotz-host-conversations'

const NOTHING_SENT = { effectsApplied: false } as const

/** The `orca_session_id:` address `wt:<name>` names among this host's conversations (spec §4.3). */
export function resolveZotzShortNameAddress(
  recipient: string,
  conversations: readonly Pick<ZotzHostConversation, 'shortName' | 'chats'>[]
): string {
  const name = normalizeZotzShortName(recipient.slice(ZOTZ_SHORT_NAME_RECIPIENT_PREFIX.length))
  const conversation = name
    ? conversations.find((candidate) => candidate.shortName === name)
    : undefined
  if (!conversation) {
    throw new OrchestrationError(
      'recipient_not_found',
      `No conversation named ${name || recipient} on this machine; \`${ZOTZ_CLI_COMMAND} agent list\` shows the names here. Nothing was sent.`,
      NOTHING_SENT
    )
  }
  const choice = chooseZotzConversationChat(conversation.chats)
  if (choice.kind === 'one') {
    return choice.chat.address
  }
  if (choice.kind === 'none') {
    throw new OrchestrationError(
      'recipient_unreachable',
      `${name} has no open conversation. Nothing was sent.`,
      NOTHING_SENT
    )
  }
  const listed = choice.chats.map((chat) => `${chat.agent} ${chat.address}`).join(', ')
  throw new OrchestrationError(
    'recipient_ambiguous',
    `${name} has ${choice.chats.length} open chats: ${listed}. Send to one with --to <address>. Nothing was sent.`,
    {
      ...NOTHING_SENT,
      candidates: choice.chats.map((chat) => ({ agent: chat.agent, address: chat.address }))
    }
  )
}

/** `wt:<name>` becomes the address of that conversation's chat on this host; any other recipient is kept. */
export async function resolveZotzShortNameRecipient(
  runtime: OrcaRuntimeService,
  recipient: string
): Promise<string> {
  return recipient.startsWith(ZOTZ_SHORT_NAME_RECIPIENT_PREFIX)
    ? resolveZotzShortNameAddress(recipient, await listZotzHostConversations(runtime))
    : recipient
}

/** A local send to `wt:<name>`; with `--on` the server it goes to resolves the name instead. */
export async function withZotzShortNameRecipient<P extends { to?: string; on?: string }>(
  runtime: OrcaRuntimeService,
  params: P
): Promise<P> {
  return params.to && params.on === undefined
    ? { ...params, to: await resolveZotzShortNameRecipient(runtime, params.to) }
    : params
}
