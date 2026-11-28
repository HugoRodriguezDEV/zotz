import {
  buildAgentChildRowModels,
  buildLegacyAgentChildRowModels,
  flattenAgentChildRowModels,
  type AgentChildRowContext,
  type AgentChildRowModel
} from './agent-child-row-model'
import { agentChildWorkIsRunning } from '../child-work/agent-child-work-listing'
import type { AgentChildWorkView } from '../child-work/agent-status-child-work-view'
import type { AgentChildWorkKind } from '../child-work/agent-status-child-work'
import type { AgentSubagentSnapshot } from '../contracts/agent-status-subagent-snapshot'

const AGENT_ONLY: ReadonlySet<AgentChildWorkKind> = new Set(['agent'])

function ownsLiveWork(row: AgentChildRowModel): boolean {
  return row.owned.some((owned) => !owned.settled || ownsLiveWork(owned))
}

/** The sidebar and workspace list show running agents, including settled owners of live work. */
export function buildRunningAgentChildRowModels(
  source: {
    children?: readonly AgentChildWorkView[]
    subagents?: readonly AgentSubagentSnapshot[]
  },
  context: AgentChildRowContext,
  /** Zotz: its sidebar also lists running workflows, commands and monitors. */
  kinds: ReadonlySet<AgentChildWorkKind> = AGENT_ONLY
): AgentChildRowModel[] {
  const rows =
    source.children !== undefined
      ? buildAgentChildRowModels(source.children, context)
      : buildLegacyAgentChildRowModels(source.subagents ?? [], context)
  return flattenAgentChildRowModels(rows).filter(
    (row) =>
      kinds.has(row.kind) &&
      agentChildWorkIsRunning({ settled: row.settled, ownsLiveWork: ownsLiveWork(row) })
  )
}
