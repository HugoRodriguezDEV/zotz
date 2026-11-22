import { defineMethod } from '../../core'
import {
  ZotzConversationsListParams,
  ZotzLinkMessagesParams,
  ZotzLinkSetPeersParams
} from '../../../../../shared/rpc-contract/zotz/zotz-conversation-links-params'
import type {
  ZotzConversationsListResult,
  ZotzLinkMessagesResult
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { listZotzHostConversations } from '../../../../zotz/conversation-links/zotz-host-conversations'
import { toZotzConversationEntry } from '../../../../zotz/conversation-links/zotz-conversation-chat-choice'
import { setZotzLinkPeers } from '../../../../zotz/conversation-links/zotz-link-peers'
import { listZotzLinkMessages } from '../../../../zotz/conversation-links/zotz-link-messages'

export const ZOTZ_CONVERSATIONS_LIST_METHOD = defineMethod({
  name: 'zotz.conversations.list',
  permission: 'workspace',
  params: ZotzConversationsListParams,
  handler: async (_params, { runtime }): Promise<ZotzConversationsListResult> => ({
    conversations: (await listZotzHostConversations(runtime))
      .filter((conversation) => !conversation.archived)
      .map(toZotzConversationEntry)
  })
})

export const ZOTZ_LINKS_SET_PEERS_METHOD = defineMethod({
  name: 'zotz.links.setPeers',
  permission: 'workspace',
  params: ZotzLinkSetPeersParams,
  handler: async (params, { runtime }) => setZotzLinkPeers(runtime, params)
})

export const ZOTZ_LINKS_MESSAGES_METHOD = defineMethod({
  name: 'zotz.links.messages',
  permission: 'workspace',
  params: ZotzLinkMessagesParams,
  handler: async (params, { runtime }): Promise<ZotzLinkMessagesResult> =>
    listZotzLinkMessages(runtime.getOrchestrationDb(), params)
})

export const ZOTZ_CONVERSATION_LINK_METHODS = [
  ZOTZ_CONVERSATIONS_LIST_METHOD,
  ZOTZ_LINKS_SET_PEERS_METHOD,
  ZOTZ_LINKS_MESSAGES_METHOD
]
