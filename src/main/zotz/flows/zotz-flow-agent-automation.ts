import type { Automation } from '../../../shared/automations/automation-definition'
import type { AutomationRun } from '../../../shared/automations/history/automation-run'
import { getRepoIdFromWorktreeId } from '../../../shared/worktree/id'
import type { ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowNodeOf } from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type { ZotzFlowAgentSessionLink } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowAgentTurnKey } from './zotz-flow-executor-types'

type AgentNode = ZotzFlowNodeOf<'agent'>

/**
 * An agent step as an unsaved automation, so it launches and is observed exactly like one
 * (spec §5). Never stored: the automation list does not know it.
 */
export function buildZotzFlowStepAutomation(
  flow: Pick<ZotzFlow, 'id' | 'name'>,
  node: AgentNode,
  prompt: string,
  workspaceId: string | null
): Automation {
  const existing = node.workspaceSource !== 'new_per_run'
  const repoId =
    node.runContext?.repoId ??
    (workspaceId && workspaceId.includes('::') ? getRepoIdFromWorktreeId(workspaceId) : '')
  return {
    id: `zotz-flow:${flow.id}:${node.id}`,
    name: `${flow.name} · ${node.name}`,
    prompt,
    precheck: null,
    agentId: node.agentId,
    surface: node.surface,
    launchSetup: { ...node.launchSetup, surface: node.surface },
    runContext: node.runContext ?? null,
    projectId: repoId,
    executionTargetType: 'local',
    executionTargetId: 'local',
    schedulerOwner: 'local_host_service',
    workspaceMode: existing ? 'existing' : 'new_per_run',
    workspaceId: existing ? workspaceId : null,
    baseBranch: node.baseBranch ?? null,
    ...(node.setupDecision ? { setupDecision: node.setupDecision } : {}),
    reuseSession: node.reuseSession,
    timezone: 'UTC',
    rrule: '',
    dtstart: 0,
    enabled: true,
    nextRunAt: 0,
    missedRunPolicy: 'run_once_within_grace',
    missedRunGraceMinutes: 0,
    createdAt: 0,
    updatedAt: 0
  }
}

/** The automation run record a launch or an observation reads; keyed by the turn. */
export function buildZotzFlowTurnRun(
  automation: Automation,
  turn: ZotzFlowAgentTurnKey,
  title: string,
  link?: ZotzFlowAgentSessionLink | null,
  status: AutomationRun['status'] = 'dispatching'
): AutomationRun {
  return {
    id: turn.id,
    automationId: automation.id,
    runContext: automation.runContext ?? null,
    title,
    scheduledFor: turn.createdAt,
    status,
    trigger: 'manual',
    workspaceId: link?.workspaceId ?? null,
    sessionKind: link?.sessionKind ?? automation.surface ?? 'chat',
    chatSessionId: link?.chatSessionId ?? null,
    terminalSessionId: link?.terminalSessionId ?? null,
    terminalPaneKey: link?.terminalPaneKey ?? null,
    terminalPtyId: link?.terminalPtyId ?? null,
    outputSnapshot: null,
    precheckResult: null,
    usage: null,
    error: null,
    startedAt: turn.createdAt,
    dispatchedAt: turn.createdAt,
    createdAt: turn.createdAt
  }
}

/** Earlier sessions of this step as finished runs, newest first, so `reuseSession` finds them. */
export function buildZotzFlowPreviousRuns(
  automation: Automation,
  previous: readonly { link: ZotzFlowAgentSessionLink; turn: ZotzFlowAgentTurnKey }[]
): AutomationRun[] {
  return previous.map(({ link, turn }) =>
    buildZotzFlowTurnRun(automation, turn, automation.name, link, 'completed')
  )
}
