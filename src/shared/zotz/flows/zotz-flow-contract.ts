import { z } from 'zod'
import { ExecutionHostId } from '../../rpc-contract/automations/automation-params'
import { ZOTZ_FLOW_MAX_NAME, ZotzFlowId, ZotzFlowSlug } from './zotz-flow-fields'
import { ZotzFlowNodeSchema } from './zotz-flow-node-contract'
import { ZotzFlowTriggerSchema } from './zotz-flow-trigger-contract'

/** Versioned contract for Flows. See docs/zotz/specs/SPEC-flows.md §4. */
export const ZOTZ_FLOW_SCHEMA = 'zotz-flow/v1'

export const ZOTZ_FLOW_DEFAULT_MAX_RUNS_PER_HOUR = 20
export const ZOTZ_FLOW_DEFAULT_CONCURRENCY = { max: 1, whenBusy: 'queue' } as const
const MAX_NODES = 500
const MAX_TRIGGERS = 50

export const ZotzFlowEdgeSchema = z.object({
  id: ZotzFlowId,
  from: z.object({ nodeId: ZotzFlowId, port: z.string().min(1).max(100) }),
  to: z.object({ nodeId: ZotzFlowId })
})
export type ZotzFlowEdge = z.infer<typeof ZotzFlowEdgeSchema>

// ---------- Flow (spec §4.1) ----------

export const ZotzFlowConcurrencySchema = z.object({
  max: z.number().int().min(1).max(20),
  whenBusy: z.enum(['queue', 'skip'])
})
export type ZotzFlowConcurrency = z.infer<typeof ZotzFlowConcurrencySchema>

const FlowFields = {
  id: ZotzFlowId,
  name: z.string().min(1).max(ZOTZ_FLOW_MAX_NAME),
  slug: ZotzFlowSlug,
  description: z.string().max(10_000).default(''),
  /** Machine that stores and runs the flow: `local` or a server. */
  hostId: ExecutionHostId,
  enabled: z.boolean().default(true),
  triggers: z.array(ZotzFlowTriggerSchema).max(MAX_TRIGGERS).default([]),
  nodes: z.array(ZotzFlowNodeSchema).max(MAX_NODES).default([]),
  edges: z
    .array(ZotzFlowEdgeSchema)
    .max(MAX_NODES * 4)
    .default([]),
  concurrency: ZotzFlowConcurrencySchema.default({ ...ZOTZ_FLOW_DEFAULT_CONCURRENCY }),
  maxRunsPerHour: z.number().int().min(1).max(10_000).default(ZOTZ_FLOW_DEFAULT_MAX_RUNS_PER_HOUR),
  migratedFromAutomationId: ZotzFlowId.optional()
}

/** What a client sends to save: the host stamps the timestamps. */
export const ZotzFlowDraftSchema = z.object(FlowFields)
export type ZotzFlowDraft = z.infer<typeof ZotzFlowDraftSchema>

export const ZotzFlowSchema = z.object({
  ...FlowFields,
  createdAt: z.number().finite(),
  updatedAt: z.number().finite()
})
export type ZotzFlow = z.infer<typeof ZotzFlowSchema>

/** One flow as a file, for `zotz flows export | import`. */
export const ZotzFlowExportSchema = z.object({
  schema: z.literal(ZOTZ_FLOW_SCHEMA),
  flow: ZotzFlowDraftSchema
})
export type ZotzFlowExport = z.infer<typeof ZotzFlowExportSchema>
