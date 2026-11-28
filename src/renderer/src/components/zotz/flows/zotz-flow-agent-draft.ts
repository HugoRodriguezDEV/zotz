import { automationCanonicalLaunchSetup } from '../../../../../shared/automations/launch/automation-canonical-launch-setup'
import type { ZotzFlowNodeOf } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import type { AutomationDraft } from '../../automations/authoring/AutomationEditorDialog'
import { AUTOMATION_DEFAULT_TIME } from '../../automations/authoring/automation-draft-model'

type AgentNode = ZotzFlowNodeOf<'agent'>

/** The automation editor's fields edit an AutomationDraft; an agent step maps onto the same shape. */
export function zotzFlowAgentToDraft(node: AgentNode): AutomationDraft {
  const setup = node.launchSetup
  return {
    name: node.name,
    prompt: node.prompt,
    agentId: node.agentId,
    surface: node.surface,
    extraAgentArgs: setup?.extraAgentArgs ?? '',
    ...(setup?.launchPreferences ? { launchPreferences: setup.launchPreferences } : {}),
    ...(setup?.agentArgs !== undefined ? { agentArgs: setup.agentArgs } : {}),
    projectId: node.runContext?.repoId ?? '',
    workspaceMode: node.workspaceSource === 'new_per_run' ? 'new_per_run' : 'existing',
    workspaceId: node.workspaceId ?? '',
    baseBranch: node.baseBranch ?? '',
    ...(node.setupDecision === 'run' || node.setupDecision === 'skip'
      ? { setupDecision: node.setupDecision }
      : {}),
    reuseSession: node.reuseSession,
    precheckCommand: '',
    precheckTimeoutSeconds: '60',
    preset: 'weekdays',
    time: AUTOMATION_DEFAULT_TIME,
    dayOfWeek: '1',
    customSchedule: '',
    savedSchedule: null,
    missedRunGraceMinutes: '720',
    scheduleWarning: null
  }
}

/** Folds what the automation fields changed back into the step; the project lives in `runContext`. */
export function zotzFlowAgentFromDraft(node: AgentNode, draft: AutomationDraft): AgentNode {
  const { surface, ...launchSetup } = automationCanonicalLaunchSetup(draft)
  const hasSetup = Object.values(launchSetup).some((value) => value !== undefined && value !== '')
  const next: AgentNode = {
    ...node,
    agentId: draft.agentId,
    surface: surface ?? draft.surface ?? node.surface,
    workspaceSource:
      node.workspaceSource === 'chat'
        ? 'chat'
        : draft.workspaceMode === 'new_per_run'
          ? 'new_per_run'
          : 'existing',
    workspaceId: draft.workspaceId || null,
    baseBranch: draft.baseBranch || null,
    reuseSession: draft.reuseSession
  }
  if (hasSetup) {
    next.launchSetup = launchSetup
  } else {
    delete next.launchSetup
  }
  return next
}
