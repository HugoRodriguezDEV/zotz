import { z } from 'zod'
import { AutomationSchedule } from '../../rpc-contract/automations/automation-params'
import {
  ZOTZ_FLOW_MAX_NAME,
  ZOTZ_FLOW_MAX_TEXT,
  ZotzFlowAgentId,
  ZotzFlowId,
  ZotzFlowIdentifier,
  ZotzFlowSlug,
  ZotzFlowTimezone
} from './zotz-flow-fields'

export const ZOTZ_FLOW_DEFAULT_CHAT_TRANSCRIPT_MESSAGES = 20
const MAX_INPUT_FIELDS = 50

// ---------- Input fields (manual, chat_command, flow_call) ----------

const InputFieldBase = {
  name: ZotzFlowIdentifier,
  label: z.string().max(ZOTZ_FLOW_MAX_NAME).optional(),
  required: z.boolean().default(false)
}

export const ZotzFlowInputFieldSchema = z.discriminatedUnion('type', [
  z.object({
    ...InputFieldBase,
    type: z.literal('text'),
    default: z.string().max(ZOTZ_FLOW_MAX_TEXT).optional()
  }),
  z.object({ ...InputFieldBase, type: z.literal('number'), default: z.number().optional() }),
  z.object({ ...InputFieldBase, type: z.literal('boolean'), default: z.boolean().optional() }),
  z.object({
    ...InputFieldBase,
    type: z.literal('select'),
    options: z.array(z.string().min(1).max(ZOTZ_FLOW_MAX_NAME)).min(1).max(100),
    default: z.string().max(ZOTZ_FLOW_MAX_NAME).optional()
  })
])
export type ZotzFlowInputField = z.infer<typeof ZotzFlowInputFieldSchema>
export type ZotzFlowInputFieldType = ZotzFlowInputField['type']

const InputFields = z.array(ZotzFlowInputFieldSchema).max(MAX_INPUT_FIELDS).default([])

/** Values a trigger delivers in `trigger.inputs`, after defaults apply. */
export const ZotzFlowInputValuesSchema = z.record(
  ZotzFlowIdentifier,
  z.union([z.string().max(ZOTZ_FLOW_MAX_TEXT), z.number(), z.boolean()])
)
export type ZotzFlowInputValues = z.infer<typeof ZotzFlowInputValuesSchema>

// ---------- Triggers (spec §4.2) ----------

/** What a chat command sends; `chat.text` always goes (spec §6.2). */
export const ZotzFlowChatContextRequestSchema = z.object({
  lastAnswer: z.boolean().default(false),
  transcript: z.boolean().default(false),
  transcriptMessages: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(ZOTZ_FLOW_DEFAULT_CHAT_TRANSCRIPT_MESSAGES),
  attachments: z.boolean().default(false),
  /** `chat.workspace`, `chat.repo`, `chat.branch`, `chat.agent`, `chat.sessionId`. */
  session: z.boolean().default(true)
})
export type ZotzFlowChatContextRequest = z.infer<typeof ZotzFlowChatContextRequestSchema>

export const ZOTZ_FLOW_AGENT_OUTCOMES = ['success', 'error', 'interrupted'] as const
export type ZotzFlowAgentOutcome = (typeof ZOTZ_FLOW_AGENT_OUTCOMES)[number]

export const ZOTZ_FLOW_PR_ACTIONS = ['opened', 'merged'] as const
export type ZotzFlowPullRequestAction = (typeof ZOTZ_FLOW_PR_ACTIONS)[number]

const TriggerBase = { id: ZotzFlowId }
const OptionalFilter = z.string().min(1).max(ZOTZ_FLOW_MAX_NAME).optional()

export const ZotzFlowTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ ...TriggerBase, kind: z.literal('manual'), inputs: InputFields }),
  z.object({
    ...TriggerBase,
    kind: z.literal('chat_command'),
    /** Own shortcut (`/revisar-pr`); without it the flow is reachable only through `/flow <slug>`. */
    command: ZotzFlowSlug.optional(),
    context: ZotzFlowChatContextRequestSchema.prefault({}),
    inputs: InputFields
  }),
  z.object({
    ...TriggerBase,
    kind: z.literal('schedule'),
    rrule: AutomationSchedule,
    timezone: ZotzFlowTimezone,
    dtstart: z.number().finite()
  }),
  z.object({
    ...TriggerBase,
    kind: z.literal('agent_finished'),
    // Empty arrays and absent filters mean "any".
    agents: z.array(ZotzFlowAgentId).max(100).default([]),
    projectId: OptionalFilter,
    workspaceId: OptionalFilter,
    outcomes: z.array(z.enum(ZOTZ_FLOW_AGENT_OUTCOMES)).max(3).default([])
  }),
  z.object({
    ...TriggerBase,
    kind: z.literal('pull_request'),
    actions: z.array(z.enum(ZOTZ_FLOW_PR_ACTIONS)).min(1).max(2),
    /** `owner/name`. */
    repo: OptionalFilter,
    baseBranch: OptionalFilter,
    label: OptionalFilter,
    author: OptionalFilter
  }),
  z.object({
    ...TriggerBase,
    kind: z.literal('task_moved'),
    /** Task board source key (connector or GitHub source). */
    source: OptionalFilter,
    project: OptionalFilter,
    fromColumn: OptionalFilter,
    toColumn: OptionalFilter
  }),
  z.object({
    ...TriggerBase,
    kind: z.literal('webhook'),
    // Sent in a header; the route is `/zotz/flows/hooks/<trigger id>`.
    token: z.string().min(32).max(256)
  }),
  z.object({ ...TriggerBase, kind: z.literal('flow_call'), inputs: InputFields })
])
export type ZotzFlowTrigger = z.infer<typeof ZotzFlowTriggerSchema>
export type ZotzFlowTriggerKind = ZotzFlowTrigger['kind']
