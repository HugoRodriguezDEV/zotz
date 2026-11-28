import type { AgentChildDisplayState } from '../../../../../shared/agent-status/child-work/agent-status-child-work-display'
import type { AgentStatusEntry } from '../../../../../shared/agent-status/contracts/agent-status-types'
import {
  getTuiAgentDetectCommands,
  TUI_AGENT_CONFIG
} from '../../../../../shared/agent-launch/catalog/tui-agent-config'
import type {
  ProgramStatusKind,
  ProgramStatusState
} from '../../../../../shared/program-status/protocol'

/** Background task kinds that get a device instead of a robot; `agent` tasks keep the robot. */
export type ZotzTaskDevice = 'command' | 'monitor' | 'workflow' | 'unknown'

/** Which device to draw and in what state; `identity` staggers its loops from its neighbors'. */
export type ZotzProcessSpec = (
  | /** A chat background task: terminal, radar, clipboard of steps or gear. */
    { device: ZotzTaskDevice; state: AgentChildDisplayState }
  /** A workspace with no agent: a rack whose lights show whether anything is alive. */
  | { device: 'rack'; state: 'active' | 'inactive' }
  /** A program reporting its own status over OSC 7501. */
  | { device: 'chip'; state: ProgramStatusState; kind?: ProgramStatusKind; progress?: number }
) & { identity?: string }

function isTaskDevice(kind: string): kind is ZotzTaskDevice {
  return kind === 'command' || kind === 'monitor' || kind === 'workflow' || kind === 'unknown'
}

/** A background task's device, or null for an agent task (which stays a robot). */
export function zotzProcessForTask(
  kind: string,
  state: AgentChildDisplayState,
  identity?: string
): ZotzProcessSpec | null {
  return isTaskDevice(kind) ? { device: kind, state, identity } : null
}

/** Only processes remain after the agent's turn: the radar keeps watch. */
export const ZOTZ_WATCHING_RADAR: ZotzProcessSpec = { device: 'monitor', state: 'monitoring' }

// Every name a known agent can report as: its id, or its command when its OSC 7501 `app` is that (dsh-tui).
const AGENT_NAMES: ReadonlySet<string> = new Set([
  'dsb',
  ...Object.keys(TUI_AGENT_CONFIG),
  ...Object.values(TUI_AGENT_CONFIG).flatMap(getTuiAgentDetectCommands)
])

/**
 * The chip for a row that only an OSC 7501 program feeds, or null for an agent's row.
 * A program row carries the program's facet and names no agent Zotz knows: the projector maps a
 * known agent's `app` (claude-code, grok-build, kiro-cli…) to its agent id and hook rows always name
 * theirs, while any other program passes its own `app` (or nothing) through.
 */
export function zotzProgramStatusProcess(agent: {
  entry: Pick<AgentStatusEntry, 'agentType' | 'programStatus' | 'paneKey'>
  childRow?: unknown
}): ZotzProcessSpec | null {
  const facet = agent.entry.programStatus
  const agentType = agent.entry.agentType
  if (agent.childRow || !facet || (agentType !== undefined && AGENT_NAMES.has(agentType))) {
    return null
  }
  return {
    device: 'chip',
    state: facet.state,
    ...(facet.kind ? { kind: facet.kind } : {}),
    ...(facet.progress !== undefined ? { progress: facet.progress } : {}),
    identity: agent.entry.paneKey
  }
}
