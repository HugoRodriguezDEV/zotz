import type { Automation } from '../../../shared/automations/automation-definition'
import { automationCanonicalLaunchSetup } from '../../../shared/automations/launch/automation-canonical-launch-setup'
import {
  ZotzFlowDraftSchema,
  type ZotzFlowDraft
} from '../../../shared/zotz/flows/zotz-flow-contract'

const STEP_GAP = 280

export type ZotzFlowFromAutomation =
  | { ok: true; draft: ZotzFlowDraft; scheduleTriggerId: string }
  | { ok: false; message: string }

/**
 * One automation as a flow (spec §8): its schedule, then the precheck as Command → Condition
 * (exit code 0) when it had one, then the same agent, prompt, setup, workspace and session.
 */
export function buildZotzFlowFromAutomation(
  automation: Automation,
  target: { hostId: string; slug: string; precheckCwd?: string }
): ZotzFlowFromAutomation {
  const prefix = `automation-${automation.id}`
  const scheduleTriggerId = `${prefix}-schedule`
  const { surface, ...launchSetup } = automationCanonicalLaunchSetup(automation)
  const hasSetup = Object.values(launchSetup).some((value) => value !== undefined && value !== '')
  const precheck = automation.precheck
  const agent = {
    id: `${prefix}-agent`,
    name: 'agente',
    kind: 'agent',
    position: { x: precheck ? STEP_GAP * 2 : 0, y: 0 },
    agentId: automation.agentId,
    prompt: automation.prompt,
    surface: surface ?? 'chat',
    ...(hasSetup ? { launchSetup } : {}),
    workspaceSource: automation.workspaceMode === 'new_per_run' ? 'new_per_run' : 'existing',
    runContext: automation.runContext ?? null,
    workspaceId: automation.workspaceId,
    baseBranch: automation.baseBranch,
    ...(automation.setupDecision ? { setupDecision: automation.setupDecision } : {}),
    reuseSession: automation.reuseSession
  }
  const nodes = precheck
    ? [
        {
          id: `${prefix}-check`,
          name: 'chequeo',
          kind: 'command',
          position: { x: 0, y: 0 },
          command: precheck.command,
          timeoutSeconds: precheck.timeoutSeconds,
          ...(target.precheckCwd ? { cwd: target.precheckCwd } : {})
        },
        {
          id: `${prefix}-passed`,
          name: 'paso_chequeo',
          kind: 'condition',
          position: { x: STEP_GAP, y: 0 },
          value: '{{chequeo.exitCode}}',
          operator: 'exit_code_zero'
        },
        agent
      ]
    : [agent]
  const edges = precheck
    ? [
        {
          id: `${prefix}-edge-check`,
          from: { nodeId: `${prefix}-check`, port: 'main' },
          to: { nodeId: `${prefix}-passed` }
        },
        {
          id: `${prefix}-edge-agent`,
          from: { nodeId: `${prefix}-passed`, port: 'true' },
          to: { nodeId: agent.id }
        }
      ]
    : []
  const parsed = ZotzFlowDraftSchema.safeParse({
    id: prefix,
    name: automation.name,
    slug: target.slug,
    hostId: target.hostId,
    enabled: automation.enabled,
    triggers: [
      {
        id: scheduleTriggerId,
        kind: 'schedule',
        rrule: automation.rrule,
        timezone: automation.timezone,
        dtstart: automation.dtstart
      }
    ],
    nodes,
    edges,
    migratedFromAutomationId: automation.id
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, message: `${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'invalid'}` }
  }
  return { ok: true, draft: parsed.data, scheduleTriggerId }
}
