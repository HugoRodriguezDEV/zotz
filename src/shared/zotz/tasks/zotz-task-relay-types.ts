import { z } from 'zod'

/** Settings → Tasks → Relay. The device token lives encrypted in main, never here. */
export type ZotzTaskRelayConfig = {
  url: string
  enabled: boolean
  hasToken?: boolean
}

/**
 * 'live': the last call to the relay worked, so the board trusts its notices and only does a full
 * refresh every 30 min. 'failing': back to the 5-min refresh until the relay answers again.
 */
export type ZotzTaskRelayStatus = {
  state: 'off' | 'live' | 'failing'
  error: string | null
  checkedAt: number | null
}

const shortText = z.string().min(1).max(200)

/** What the relay stores per webhook or provider push: which thing changed, never its content. */
export const zotzRelayNoticeSchema = z.object({
  cursor: z.string().regex(/^\d{1,16}$/),
  kind: z.enum([
    'issues',
    'pull_request',
    'push',
    'projects_v2_item',
    'installation',
    'source_push'
  ]),
  action: shortText,
  at: shortText,
  installationId: z.number().int().optional(),
  owner: shortText.optional(),
  repo: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .optional(),
  number: z.number().int().positive().optional(),
  projectNodeId: shortText.optional(),
  projectItemNodeId: shortText.optional(),
  sourceId: z
    .string()
    .regex(/^[a-z0-9-]{1,64}$/)
    .optional(),
  documentId: shortText.optional()
})

export type ZotzRelayNotice = z.infer<typeof zotzRelayNoticeSchema>

export const zotzRelayEventsSchema = z.object({
  ok: z.literal(true),
  /** The relay can't continue from the given cursor: reload everything, then go on from `cursor`. */
  reset: z.boolean(),
  cursor: z.string().regex(/^\d{1,16}$/),
  notices: z.array(z.unknown()).max(1000)
})

/** Pushed from main to the board: a status change, notices to apply, or both. */
export type ZotzTaskRelayUpdate = {
  status: ZotzTaskRelayStatus
  notices: ZotzRelayNotice[]
  /** Notices were lost (relay trimmed or wiped them): reload the whole board. */
  reset: boolean
}

export const ZOTZ_TASK_RELAY_OFF: ZotzTaskRelayStatus = {
  state: 'off',
  error: null,
  checkedAt: null
}

export function readZotzTaskRelayConfig(value: unknown): ZotzTaskRelayConfig | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const { url, enabled, hasToken } = value as Record<string, unknown>
  return typeof url === 'string' && /^https?:\/\//i.test(url)
    ? { url, enabled: enabled === true, hasToken: hasToken === true }
    : null
}
