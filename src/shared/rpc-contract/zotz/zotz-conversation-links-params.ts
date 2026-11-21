import { z } from 'zod'

export const ZotzConversationsListParams = z.object({})

const ZotzLinkPeer = z.object({
  shortName: z.string().min(1).max(64),
  title: z.string().max(512),
  machine: z.string().max(256).nullable(),
  reach: z.enum(['direct', 'on-server', 'reply-only'])
})

// An empty peers list unlinks the conversation.
export const ZotzLinkSetPeersParams = z.object({
  path: z.string().min(1).max(4096),
  peers: z.array(ZotzLinkPeer).max(64)
})

export const ZotzLinkMessagesParams = z.object({
  addresses: z.array(z.string().min(1).max(512)).min(1).max(64),
  limit: z.number().int().min(1).max(1000).optional()
})
