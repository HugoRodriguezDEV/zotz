import { z } from 'zod'
import { ZotzFlowDraftSchema, type ZotzFlow } from '../../zotz/flows/zotz-flow-contract'
import { ZotzFlowInputValuesSchema } from '../../zotz/flows/zotz-flow-trigger-contract'
import {
  ZotzFlowChatContextSchema,
  type ZotzFlowRun,
  type ZotzFlowRunsPage
} from '../../zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowProblem } from '../../zotz/flows/zotz-flow-problems'

// Same bound the window IPC applies to an id.
const Id = z.string().min(1).max(1024)

export const ZotzFlowsListParams = z.object({})

export const ZotzFlowsGetParams = z.object({ id: Id })

export const ZotzFlowsSaveParams = z.object({
  flow: ZotzFlowDraftSchema,
  /** `updatedAt` the client edited; a newer stored flow refuses the save. Null creates. */
  expectedUpdatedAt: z.number().finite().nullable()
})

export const ZotzFlowsDeleteParams = z.object({ id: Id })

export const ZotzFlowsRunParams = z
  .object({
    /** The CLI and `/flow <slug>` address a flow by slug. */
    id: Id.optional(),
    slug: z.string().min(1).max(64).optional(),
    /** Absent: a manual run, even when the flow has no manual trigger. */
    triggerId: Id.optional(),
    inputs: ZotzFlowInputValuesSchema.default({}),
    /** Text after the chat command, delivered as `trigger.text`. */
    text: z.string().max(200_000).optional(),
    chat: ZotzFlowChatContextSchema.optional(),
    /** Run only this node with the last run's inputs ("test a node"). */
    testNodeId: Id.optional()
  })
  .refine((params) => (params.id === undefined) !== (params.slug === undefined), {
    message: 'Pass exactly one of id or slug'
  })

export const ZotzFlowsCancelParams = z.object({ runId: Id })

export const ZotzFlowsRetryParams = z.object({
  runId: Id,
  /** Defaults to the node that failed. */
  fromNodeId: Id.optional()
})

export const ZotzFlowsRunsParams = z.object({
  flowId: Id,
  limit: z.number().int().min(1).max(200).optional(),
  cursor: z.string().max(1024).optional()
})

export const ZotzFlowsRunGetParams = z.object({ runId: Id })

export const ZotzFlowsApproveParams = z.object({
  runId: Id,
  nodeId: Id,
  /** Loop indexes of the waiting approval when it sits inside a `for_each`. */
  iteration: z.array(z.number().int().min(0)).max(16).default([]),
  decision: z.enum(['approved', 'rejected']),
  note: z.string().max(10_000).optional()
})

/** Runs a chat fired on this host, newest first: the chat draws a card for each (spec §6.3). */
export const ZotzFlowsChatRunsParams = z.object({
  chatSessionId: Id,
  limit: z.number().int().min(1).max(200).optional()
})

/** Omitting both streams every flow and run change on the host. */
export const ZotzFlowsSubscribeParams = z.object({
  flowId: Id.optional(),
  runId: Id.optional()
})

export type ZotzFlowsListResult = { flows: ZotzFlow[] }
export type ZotzFlowsGetResult = { flow: ZotzFlow | null }
/** Errors block the save; warnings come back with the saved flow. */
export type ZotzFlowsSaveResult =
  | { saved: true; flow: ZotzFlow; problems: ZotzFlowProblem[] }
  | { saved: false; reason: 'invalid'; problems: ZotzFlowProblem[] }
  | { saved: false; reason: 'conflict'; current: ZotzFlow }
export type ZotzFlowsDeleteResult = { deleted: boolean }
export type ZotzFlowsRunResult = { run: ZotzFlowRun }
export type ZotzFlowsRetryResult = { run: ZotzFlowRun }
export type ZotzFlowsCancelResult = { run: ZotzFlowRun | null }
export type ZotzFlowsRunsResult = ZotzFlowRunsPage
export type ZotzFlowsRunGetResult = { run: ZotzFlowRun | null }
export type ZotzFlowsChatRunsResult = { runs: ZotzFlowRun[] }
export type ZotzFlowsApproveResult = { run: ZotzFlowRun }
export type ZotzFlowsStreamEvent =
  | { type: 'flow'; flow: ZotzFlow }
  | { type: 'flow_deleted'; flowId: string }
  | { type: 'run'; run: ZotzFlowRun }
