import { z } from 'zod'
import type { TuiAgent } from '../../agent-launch/catalog/tui-agent'
import { isTuiAgent } from '../../agent-launch/catalog/tui-agent-config'

// Bounds keep a hand-edited or imported flow file from exhausting the host.
export const ZOTZ_FLOW_MAX_NAME = 200
export const ZOTZ_FLOW_MAX_TEXT = 200_000

/** Names usable inside `{{ }}`: they are template path segments, so no dots or dashes. */
export const ZOTZ_FLOW_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
export const ZOTZ_FLOW_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Template roots that are not nodes; a node cannot take one of these names. */
export const ZOTZ_FLOW_RESERVED_NAMES = ['trigger', 'chat', 'item'] as const

export const ZotzFlowId = z.string().min(1).max(1024)
export const ZotzFlowIdentifier = z.string().max(100).regex(ZOTZ_FLOW_IDENTIFIER_PATTERN)
export const ZotzFlowSlug = z.string().max(64).regex(ZOTZ_FLOW_SLUG_PATTERN)
export const ZotzFlowText = z.string().max(ZOTZ_FLOW_MAX_TEXT)
export const ZotzFlowTimezone = z.string().min(1).max(100)
export const ZotzFlowAgentId = z.custom<TuiAgent>(isTuiAgent, { message: 'Unknown provider' })
