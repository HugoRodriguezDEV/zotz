import type { TuiAgent } from '../../../shared/agent-launch/catalog/tui-agent'
import type { ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowNode,
  ZotzFlowNodeOf
} from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type {
  ZotzFlowAgentSessionLink,
  ZotzFlowNodeAttempt,
  ZotzFlowNodeOutput,
  ZotzFlowNodeRun,
  ZotzFlowRun
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowLoopItem } from './zotz-flow-template-resolution'

/** A step failure; `output` keeps what the step produced so the run view can show it. */
export class ZotzFlowStepError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly output: ZotzFlowNodeOutput | null = null
  ) {
    super(message)
  }
}

export type ZotzFlowStepResult = { port?: string; output?: ZotzFlowNodeOutput | null }

export type ZotzFlowLevelResult = {
  /** A step stopped this level (its `onError` is `stop`). */
  failed: boolean
  error: string | null
  /** The level's last step: a loop body ends in exactly one. */
  exit: ZotzFlowNodeRun | null
}

// ---------- Agents ----------

/** Identity of one prompt to an agent; stable across restarts so observation can reattach. */
export type ZotzFlowAgentTurnKey = { id: string; createdAt: number }

export type ZotzFlowAgentReply = { text: string; truncated: boolean }

export type ZotzFlowAgentTurn = {
  link: ZotzFlowAgentSessionLink
  /** Rejects with the agent's error, or when the signal aborts. */
  reply: Promise<ZotzFlowAgentReply>
}

type AgentNode = ZotzFlowNodeOf<'agent'>

export type ZotzFlowAgentDriver = {
  /**
   * Waits in the memory queue with automation priority; null when that wait was canceled.
   * `release` runs once the launch returned, so an unused pass cannot linger.
   */
  admit(request: {
    agent: TuiAgent
    label: string
    signal: AbortSignal
  }): Promise<{ release: () => void } | null>
  start(request: {
    flow: ZotzFlow
    run: ZotzFlowRun
    node: AgentNode
    prompt: string
    turn: ZotzFlowAgentTurnKey
    signal: AbortSignal
  }): Promise<ZotzFlowAgentTurn>
  /** Sends another prompt to the same session (the JSON correction). */
  followUp(request: {
    node: AgentNode
    link: ZotzFlowAgentSessionLink
    prompt: string
    turn: ZotzFlowAgentTurnKey
    signal: AbortSignal
  }): Promise<ZotzFlowAgentTurn>
  /** After a restart; null when the session cannot be found again. */
  reattach(request: {
    node: AgentNode
    link: ZotzFlowAgentSessionLink
    turn: ZotzFlowAgentTurnKey
    signal: AbortSignal
  }): Promise<ZotzFlowAgentReply> | null
  stop(link: ZotzFlowAgentSessionLink): Promise<void>
}

// ---------- Commands, HTTP, notices, subflows ----------

export type ZotzFlowCommandRequest = {
  command: string
  env: Record<string, string>
  cwd: string | undefined
  signal: AbortSignal
}

export type ZotzFlowCommandResult = {
  exitCode: number | null
  stdout: string
  stderr: string
  truncated: boolean
  error: string | null
}

export type ZotzFlowHttpRequest = {
  method: string
  url: string
  headers: Record<string, string>
  body: string | undefined
  signal: AbortSignal
}

export type ZotzFlowHttpResponse = { status: number; body: string; truncated: boolean }

export type ZotzFlowExecutorDeps = {
  now(): number
  save(run: ZotzFlowRun): void
  agents: ZotzFlowAgentDriver
  runCommand(request: ZotzFlowCommandRequest): Promise<ZotzFlowCommandResult>
  fetch(request: ZotzFlowHttpRequest): Promise<ZotzFlowHttpResponse>
  notify(request: { title: string; body: string; flow: ZotzFlow; run: ZotzFlowRun }): Promise<void>
  /** Starts (or, after a restart, rejoins) a child run and settles once it is final. */
  runSubflow(request: {
    flowId: string
    inputs: Record<string, string>
    parent: { flowId: string; runId: string; nodeId: string }
    existingRunId: string | undefined
    onStarted: (runId: string) => void
    signal: AbortSignal
  }): Promise<{ run: ZotzFlowRun; output: ZotzFlowNodeOutput | null }>
}

// ---------- One step ----------

export type ZotzFlowStepContext = {
  deps: ZotzFlowExecutorDeps
  flow: ZotzFlow
  run: ZotzFlowRun
  node: ZotzFlowNode
  nodeRun: ZotzFlowNodeRun
  path: number[]
  item: ZotzFlowLoopItem | null
  attempt: ZotzFlowNodeAttempt
  /** Aborts on cancel, timeout or a sibling step that stopped this level. */
  signal: AbortSignal
  /** Re-entering a step that was in progress when Zotz stopped. */
  resuming: boolean
  resolve(text: string): string
  resolveValue(text: string): unknown
  /** Starts the step timeout; an agent calls it once out of the memory queue. */
  markStarted(): void
  changed(): void
  runLevel(parentId: string, path: number[], item: ZotzFlowLoopItem): Promise<ZotzFlowLevelResult>
  waitForApproval(): Promise<'approved' | 'rejected' | 'timeout'>
}
