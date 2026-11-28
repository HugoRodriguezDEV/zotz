import {
  Bot,
  CalendarClock,
  GitPullRequest,
  Hand,
  Kanban,
  MessageSquare,
  Webhook,
  Workflow,
  type LucideIcon
} from 'lucide-react'
import { buildAutomationRrule } from '../../../../../shared/automations/scheduling/automation-schedule-occurrences'
import { ZOTZ_FLOW_DEFAULT_CHAT_TRANSCRIPT_MESSAGES } from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import type {
  ZotzFlowTrigger,
  ZotzFlowTriggerKind
} from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'

export const ZOTZ_FLOW_TRIGGER_KINDS: Record<
  ZotzFlowTriggerKind,
  { icon: LucideIcon; copy: readonly [string, string] }
> = {
  manual: { icon: Hand, copy: ['zotz.flows.trigger.manual', 'Manual'] },
  chat_command: {
    icon: MessageSquare,
    copy: ['zotz.flows.trigger.chatCommand', 'Chat command']
  },
  schedule: { icon: CalendarClock, copy: ['zotz.flows.trigger.schedule', 'Schedule'] },
  agent_finished: {
    icon: Bot,
    copy: ['zotz.flows.trigger.agentFinished', 'Agent finished']
  },
  pull_request: {
    icon: GitPullRequest,
    copy: ['zotz.flows.trigger.pullRequest', 'Pull request']
  },
  task_moved: { icon: Kanban, copy: ['zotz.flows.trigger.taskMoved', 'Task moved'] },
  webhook: { icon: Webhook, copy: ['zotz.flows.trigger.webhook', 'Webhook'] },
  flow_call: { icon: Workflow, copy: ['zotz.flows.trigger.flowCall', 'Called by a flow'] }
}

export const ZOTZ_FLOW_TRIGGER_ORDER: ZotzFlowTriggerKind[] = [
  'manual',
  'chat_command',
  'schedule',
  'agent_finished',
  'pull_request',
  'task_moved',
  'webhook',
  'flow_call'
]

function webhookToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createZotzFlowTrigger<K extends ZotzFlowTriggerKind>(
  kind: K,
  id: string
): Extract<ZotzFlowTrigger, { kind: K }> {
  const trigger = buildZotzFlowTrigger(kind, id)
  if (!isTriggerOfKind(trigger, kind)) {
    throw new Error(`No default for trigger kind ${kind}`)
  }
  return trigger
}

function isTriggerOfKind<K extends ZotzFlowTriggerKind>(
  trigger: ZotzFlowTrigger,
  kind: K
): trigger is Extract<ZotzFlowTrigger, { kind: K }> {
  return trigger.kind === kind
}

function buildZotzFlowTrigger(kind: ZotzFlowTriggerKind, id: string): ZotzFlowTrigger {
  switch (kind) {
    case 'manual':
    case 'flow_call':
      return { id, kind, inputs: [] }
    case 'chat_command':
      return {
        id,
        kind,
        context: {
          lastAnswer: false,
          transcript: false,
          transcriptMessages: ZOTZ_FLOW_DEFAULT_CHAT_TRANSCRIPT_MESSAGES,
          attachments: false,
          session: true
        },
        inputs: []
      }
    case 'schedule':
      return {
        id,
        kind,
        rrule: buildAutomationRrule({ preset: 'weekdays', hour: 9, minute: 0, dayOfWeek: 1 }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dtstart: Date.now()
      }
    case 'agent_finished':
      return { id, kind, agents: [], outcomes: [] }
    case 'pull_request':
      return { id, kind, actions: ['opened'] }
    case 'task_moved':
      return { id, kind }
    case 'webhook':
      return { id, kind, token: webhookToken() }
  }
}
