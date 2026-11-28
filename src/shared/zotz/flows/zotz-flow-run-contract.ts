import { z } from 'zod'
import type { TuiAgent } from '../../agent-launch/catalog/tui-agent'
import type { ExecutionHostId } from '../../execution-host'
import type {
  ZotzFlowAgentOutcome,
  ZotzFlowInputValues,
  ZotzFlowPullRequestAction
} from './zotz-flow-trigger-contract'

/** Runs kept per flow, like automation run retention. See docs/zotz/specs/SPEC-flows.md §5. */
export const ZOTZ_FLOW_RUNS_RETAINED_PER_FLOW = 200

export const ZOTZ_FLOW_NODE_RUN_STATUSES = [
  'pending',
  // Waiting in the memory queue: the node timeout has not started yet.
  'queued',
  'running',
  'waiting_approval',
  'done',
  'failed',
  'skipped',
  'cancelled'
] as const
export type ZotzFlowNodeRunStatus = (typeof ZOTZ_FLOW_NODE_RUN_STATUSES)[number]

export const ZOTZ_FLOW_RUN_STATUSES = [
  // Waiting for a concurrency slot.
  'queued',
  'running',
  'waiting_approval',
  'done',
  'failed',
  // Never started: the flow was busy with `whenBusy: 'skip'`, or hit its hourly cap.
  'skipped',
  'cancelled'
] as const
export type ZotzFlowRunStatus = (typeof ZOTZ_FLOW_RUN_STATUSES)[number]

export function isFinalZotzFlowRunStatus(status: ZotzFlowRunStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'skipped' || status === 'cancelled'
}

// ---------- Trigger payloads (spec §4.2): what `{{trigger.*}}` reads ----------

export type ZotzFlowTriggerPayload =
  | { kind: 'manual'; inputs: ZotzFlowInputValues }
  | { kind: 'chat_command'; inputs: ZotzFlowInputValues; text: string }
  | { kind: 'schedule'; scheduledFor: number }
  | {
      kind: 'agent_finished'
      // Any agent status type, not only launchable TUI agents.
      agent: { agentId: string; sessionId: string | null; title: string | null }
      workspace: { id: string; name: string | null; path: string | null; branch: string | null }
      lastMessage: string
      outcome: ZotzFlowAgentOutcome
    }
  | {
      kind: 'pull_request'
      action: ZotzFlowPullRequestAction
      pr: {
        number: number
        title: string
        body: string
        repo: string
        branch: string
        baseBranch: string
        author: string
        url: string
        changedFiles: string[]
      }
    }
  | {
      kind: 'task_moved'
      task: {
        id: string
        title: string
        body: string
        fields: Record<string, string | number | null>
        url: string | null
      }
      from: string
      to: string
    }
  // Headers never include the flow token.
  | { kind: 'webhook'; body: unknown; headers: Record<string, string> }
  | { kind: 'flow_call'; inputs: ZotzFlowInputValues; callerFlowId: string; callerRunId: string }

/** `triggerId` is null when a flow without a manual trigger is run from the app or CLI. */
export type ZotzFlowRunTrigger = { triggerId: string | null } & ZotzFlowTriggerPayload

// ---------- Chat context (spec §6.2): what `{{chat.*}}` reads ----------

const BoundedText = z.string().max(200_000)

/** Only the parts the chat_command trigger requested are present. */
export const ZotzFlowChatContextSchema = z.object({
  text: BoundedText,
  lastAnswer: BoundedText.optional(),
  transcript: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: BoundedText,
        at: z.number().finite().optional()
      })
    )
    .max(200)
    .optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().max(1024),
        path: z.string().max(4096),
        mimeType: z.string().max(200).optional()
      })
    )
    .max(50)
    .optional(),
  workspace: z
    .object({
      id: z.string().max(1024),
      name: z.string().max(1024).nullable(),
      path: z.string().max(4096).nullable()
    })
    .nullable()
    .optional(),
  repo: z.string().max(1024).nullable().optional(),
  branch: z.string().max(1024).nullable().optional(),
  agent: z.string().max(100).nullable().optional(),
  /** The chat session; `runInChatSession` agent nodes send their prompt here. */
  sessionId: z.string().max(1024).nullable().optional()
})
export type ZotzFlowChatContext = z.infer<typeof ZotzFlowChatContextSchema>

/** Template keys under `chat.*`, mapped to the trigger request flag that provides them. */
export const ZOTZ_FLOW_CHAT_TEMPLATE_KEYS = {
  text: null,
  lastAnswer: 'lastAnswer',
  transcript: 'transcript',
  attachments: 'attachments',
  workspace: 'session',
  repo: 'session',
  branch: 'session',
  agent: 'session',
  sessionId: 'session'
} as const satisfies Record<
  keyof ZotzFlowChatContext,
  'lastAnswer' | 'transcript' | 'attachments' | 'session' | null
>

// ---------- Node runs ----------

export type ZotzFlowNodeOutput = {
  /** Text result: agent final answer, command stdout, HTTP body, rendered template. */
  markdown: string | null
  /** Parsed and validated JSON when the node's format is JSON. */
  json: unknown
  truncated: boolean
  capturedAt: number
}

export type ZotzFlowNodeAttempt = {
  attempt: number
  startedAt: number
  finishedAt: number | null
  error: string | null
}

/** Session an agent node launched; same identity an automation run keeps. */
export type ZotzFlowAgentSessionLink = {
  agentId: TuiAgent
  sessionKind: 'chat' | 'terminal'
  workspaceId: string | null
  chatSessionId: string | null
  terminalSessionId: string | null
  terminalPaneKey: string | null
  terminalPtyId: string | null
}

export type ZotzFlowApprovalRecord = {
  requestedAt: number
  decidedAt: number | null
  decision: 'approved' | 'rejected' | 'timeout' | null
  decidedBy: string | null
  note: string | null
}

export type ZotzFlowLoopIteration = {
  index: number
  status: ZotzFlowNodeRunStatus
  /** Output of the body's exit node for this item. */
  output: ZotzFlowNodeOutput | null
  error: string | null
}

export type ZotzFlowNodeRun = {
  nodeId: string
  /** Loop indexes from the outermost `for_each` in; empty outside loops. Keyed with `nodeId`. */
  iteration: number[]
  status: ZotzFlowNodeRunStatus
  /** Template fields after resolution, keyed like `getZotzFlowNodeTemplateFields`. */
  inputs: Record<string, string>
  output: ZotzFlowNodeOutput | null
  /** Port the run left through; null until it finishes or when it stopped the flow. */
  port: string | null
  attempts: ZotzFlowNodeAttempt[]
  /** Agent JSON output failed validation once and a correction was requested (spec §4.4). */
  jsonCorrectionRequested?: boolean
  exitCode?: number | null
  stderr?: string | null
  httpStatus?: number | null
  agentSession?: ZotzFlowAgentSessionLink
  approval?: ZotzFlowApprovalRecord
  /** `for_each` only. */
  loop?: { total: number; iterations: ZotzFlowLoopIteration[] }
  /** `subflow` only. */
  childRunId?: string
  error: string | null
  errorCode?: string
  /** Entered the memory queue; the timeout counts from `startedAt`, not from here. */
  queuedAt: number | null
  startedAt: number | null
  finishedAt: number | null
}

export type ZotzFlowRun = {
  id: string
  flowId: string
  /** `updatedAt` of the flow version this run executes. */
  flowUpdatedAt: number
  runNumber: number
  hostId: ExecutionHostId
  status: ZotzFlowRunStatus
  trigger: ZotzFlowRunTrigger
  chat: ZotzFlowChatContext | null
  nodes: ZotzFlowNodeRun[]
  /** Set by retry: the run resumed from this node with the same inputs. */
  resumedFromNodeId?: string
  /** Set by "test a node": only this node runs, with the previous run's inputs. */
  testNodeId?: string
  /** Set when a subflow node started this run. */
  parent?: { flowId: string; runId: string; nodeId: string }
  error: string | null
  errorCode?: string
  createdAt: number
  queuedAt: number
  startedAt: number | null
  finishedAt: number | null
}

export type ZotzFlowRunsPage = {
  runs: ZotzFlowRun[]
  nextCursor: string | null
}
