import { z } from 'zod'
import {
  AutomationCanonicalLaunchSetup,
  SetupDecision,
  WorkspaceRunContext
} from '../../rpc-contract/automations/automation-params'
import {
  ZOTZ_FLOW_MAX_NAME,
  ZotzFlowAgentId,
  ZotzFlowId,
  ZotzFlowIdentifier,
  ZotzFlowText,
  ZotzFlowTimezone
} from './zotz-flow-fields'

export const ZOTZ_FLOW_DEFAULT_FOR_EACH_MAX_ITEMS = 100
export const ZOTZ_FLOW_MAX_RETRIES = 3

// ---------- Output format (spec §4.4) ----------

export const ZOTZ_FLOW_JSON_FIELD_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object'
] as const

export const ZotzFlowJsonFieldSchema = z.object({
  name: ZotzFlowIdentifier,
  type: z.enum(ZOTZ_FLOW_JSON_FIELD_TYPES),
  required: z.boolean().default(true),
  description: z.string().max(2000).optional()
})
export type ZotzFlowJsonField = z.infer<typeof ZotzFlowJsonFieldSchema>

const JSON_SCHEMA_TYPES = new Set<string>([...ZOTZ_FLOW_JSON_FIELD_TYPES, 'null'])

// Shallow check only: shared code has no JSON Schema validator, the engine compiles it on run.
const JsonSchemaDocument = z.record(z.string(), z.unknown()).refine(
  (schema) => {
    const type = schema.type
    if (type === undefined) {
      return true
    }
    const types = Array.isArray(type) ? type : [type]
    return types.length > 0 && types.every((t) => typeof t === 'string' && JSON_SCHEMA_TYPES.has(t))
  },
  { message: 'Invalid JSON Schema type' }
)

export const ZotzFlowOutputFormatSchema = z.union([
  z.object({ mode: z.literal('markdown') }),
  z.object({
    mode: z.literal('json'),
    fields: z.array(ZotzFlowJsonFieldSchema).min(1).max(100)
  }),
  z.object({ mode: z.literal('json'), schema: JsonSchemaDocument })
])
export type ZotzFlowOutputFormat = z.infer<typeof ZotzFlowOutputFormatSchema>

const Output = ZotzFlowOutputFormatSchema.default({ mode: 'markdown' })

// ---------- Nodes (spec §4.3, §4.3.1) ----------

export const ZOTZ_FLOW_ON_ERROR = ['stop', 'continue', 'error_port'] as const
export type ZotzFlowOnError = (typeof ZOTZ_FLOW_ON_ERROR)[number]

const NodeBase = {
  id: ZotzFlowId,
  name: ZotzFlowIdentifier,
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  /** The `for_each` whose body holds this node. */
  parentId: ZotzFlowId.optional(),
  timeoutSeconds: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 60 * 60)
    .optional(),
  retries: z.number().int().min(0).max(ZOTZ_FLOW_MAX_RETRIES).default(0),
  onError: z.enum(ZOTZ_FLOW_ON_ERROR).default('stop')
}

/** `chat`: the workspace of the chat that fired the flow (chat_command trigger only). */
export const ZOTZ_FLOW_WORKSPACE_SOURCES = ['existing', 'new_per_run', 'chat'] as const

export const ZOTZ_FLOW_CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'exists',
  'not_exists',
  'exit_code_zero'
] as const
export type ZotzFlowConditionOperator = (typeof ZOTZ_FLOW_CONDITION_OPERATORS)[number]

export const ZOTZ_FLOW_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const NameValue = z.object({ name: z.string().min(1).max(ZOTZ_FLOW_MAX_NAME), value: ZotzFlowText })

export const ZotzFlowNodeSchema = z.discriminatedUnion('kind', [
  z.object({
    ...NodeBase,
    kind: z.literal('agent'),
    agentId: ZotzFlowAgentId,
    prompt: ZotzFlowText,
    surface: z.enum(['chat', 'terminal']).default('chat'),
    launchSetup: AutomationCanonicalLaunchSetup.omit({ surface: true }).optional(),
    workspaceSource: z.enum(ZOTZ_FLOW_WORKSPACE_SOURCES),
    runContext: WorkspaceRunContext,
    /** For `existing`. */
    workspaceId: ZotzFlowId.nullable().optional(),
    /** For `new_per_run`. */
    baseBranch: z.string().max(ZOTZ_FLOW_MAX_NAME).nullable().optional(),
    setupDecision: SetupDecision,
    reuseSession: z.boolean().default(false),
    /** Sends the prompt to the chat session that fired the flow instead of opening one. */
    runInChatSession: z.boolean().default(false),
    output: Output
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('command'),
    // Literal text: templates go through `env` so a value can never inject shell (spec §4.5).
    command: ZotzFlowText,
    /** Each entry is exposed as `ZOTZ_FLOW_<NAME>`; `value` accepts templates. */
    env: z
      .array(z.object({ name: ZotzFlowIdentifier, value: ZotzFlowText }))
      .max(100)
      .default([]),
    cwd: z.string().max(4096).optional(),
    output: Output
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('condition'),
    /** Template, e.g. `{{revisar.json.riesgo}}`. */
    value: ZotzFlowText,
    operator: z.enum(ZOTZ_FLOW_CONDITION_OPERATORS),
    /** Ignored by `exists`, `not_exists` and `exit_code_zero`. */
    compareTo: ZotzFlowText.optional()
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('switch'),
    value: ZotzFlowText,
    /** Each case is an output port named `port`; anything else leaves by `default`. */
    cases: z
      .array(z.object({ port: ZotzFlowIdentifier, equals: ZotzFlowText }))
      .min(1)
      .max(50)
  }),
  z.object({ ...NodeBase, kind: z.literal('parallel') }),
  z.object({
    ...NodeBase,
    kind: z.literal('join'),
    waitFor: z.enum(['all', 'first']).default('all')
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('approval'),
    message: ZotzFlowText
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('wait'),
    wait: z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('duration'),
        seconds: z
          .number()
          .int()
          .positive()
          .max(30 * 24 * 60 * 60)
      }),
      z.object({
        mode: z.literal('until_time'),
        /** `HH:MM`, next occurrence in `timezone`. */
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        timezone: ZotzFlowTimezone
      })
    ])
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('http'),
    method: z.enum(ZOTZ_FLOW_HTTP_METHODS),
    url: z.string().min(1).max(8192),
    headers: z.array(NameValue).max(100).default([]),
    body: ZotzFlowText.optional(),
    output: Output
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('notify'),
    title: z.string().min(1).max(ZOTZ_FLOW_MAX_NAME),
    body: ZotzFlowText.default('')
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('chat_reply'),
    /** `note`: card in the chat, never sent to the agent; `agent_message`: a new message to the session. */
    mode: z.enum(['note', 'agent_message']),
    content: ZotzFlowText
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('template'),
    /** In JSON mode the resolved text is parsed as JSON and checked against the format. */
    content: ZotzFlowText,
    output: Output
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('subflow'),
    flowId: ZotzFlowId,
    /** Values for the callee's `flow_call` inputs; accept templates. */
    inputs: z.record(ZotzFlowIdentifier, ZotzFlowText).default({})
  }),
  z.object({
    ...NodeBase,
    kind: z.literal('for_each'),
    /** Template yielding a JSON array, or Markdown split into one item per non-empty line. */
    items: ZotzFlowText,
    order: z.enum(['parallel', 'sequential']).default('parallel'),
    maxItems: z.number().int().positive().max(10_000).default(ZOTZ_FLOW_DEFAULT_FOR_EACH_MAX_ITEMS)
  })
])
export type ZotzFlowNode = z.infer<typeof ZotzFlowNodeSchema>
export type ZotzFlowNodeKind = ZotzFlowNode['kind']
export type ZotzFlowNodeOf<K extends ZotzFlowNodeKind> = Extract<ZotzFlowNode, { kind: K }>
export type ZotzFlowWorkspaceSource = ZotzFlowNodeOf<'agent'>['workspaceSource']

/** Node kinds whose result carries the Markdown/JSON switch. */
export const ZOTZ_FLOW_FORMATTED_OUTPUT_KINDS = ['agent', 'command', 'http', 'template'] as const

// ---------- Ports and edges ----------

export const ZOTZ_FLOW_ERROR_PORT = 'error'
export const ZOTZ_FLOW_SWITCH_DEFAULT_PORT = 'default'

/** Output ports of a node; the engine routes by them and the canvas draws them. */
export function getZotzFlowNodePorts(node: ZotzFlowNode): string[] {
  const ports = getZotzFlowNodeBasePorts(node)
  return node.onError === 'error_port' ? [...ports, ZOTZ_FLOW_ERROR_PORT] : ports
}

function getZotzFlowNodeBasePorts(node: ZotzFlowNode): string[] {
  switch (node.kind) {
    case 'condition':
      return ['true', 'false']
    case 'switch':
      return [...node.cases.map((entry) => entry.port), ZOTZ_FLOW_SWITCH_DEFAULT_PORT]
    case 'approval':
      return node.timeoutSeconds === undefined
        ? ['approved', 'rejected']
        : ['approved', 'rejected', 'timeout']
    case 'for_each':
      return ['complete', 'with_failures']
    case 'agent':
    case 'command':
    case 'parallel':
    case 'join':
    case 'wait':
    case 'http':
    case 'notify':
    case 'chat_reply':
    case 'template':
    case 'subflow':
      return ['main']
  }
}
