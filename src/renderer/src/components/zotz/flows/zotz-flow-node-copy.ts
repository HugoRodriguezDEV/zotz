import type { Translate } from '@/i18n/use-translate'
import {
  ZOTZ_FLOW_ERROR_PORT,
  type ZotzFlowNode
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import type { ZotzFlowNodeRunStatus } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'

const PORT_COPY: Record<string, [string, string]> = {
  true: ['zotz.flows.port.true', 'Yes'],
  false: ['zotz.flows.port.false', 'No'],
  approved: ['zotz.flows.port.approved', 'Approved'],
  rejected: ['zotz.flows.port.rejected', 'Rejected'],
  timeout: ['zotz.flows.port.timeout', 'Timed out'],
  complete: ['zotz.flows.port.complete', 'Complete'],
  with_failures: ['zotz.flows.port.withFailures', 'With failures'],
  default: ['zotz.flows.port.default', 'Otherwise']
}

/** Empty for `main`: a single output needs no label. Switch cases show their own name. */
export function zotzFlowPortLabel(node: ZotzFlowNode, port: string, t: Translate): string {
  if (port === 'main') {
    return ''
  }
  if (node.kind === 'switch' && node.cases.some((entry) => entry.port === port)) {
    return port
  }
  if (port === ZOTZ_FLOW_ERROR_PORT) {
    return t('zotz.flows.port.error', 'Error')
  }
  const copy = PORT_COPY[port]
  return copy ? t(copy[0], copy[1]) : port
}

export const ZOTZ_FLOW_STATUS_COPY: Record<ZotzFlowNodeRunStatus, [string, string]> = {
  pending: ['zotz.flows.status.pending', 'Pending'],
  queued: ['zotz.flows.status.queued', 'Queued'],
  running: ['zotz.flows.status.running', 'Running'],
  waiting_approval: ['zotz.flows.status.waitingApproval', 'Waiting for approval'],
  done: ['zotz.flows.status.done', 'Done'],
  failed: ['zotz.flows.status.failed', 'Failed'],
  skipped: ['zotz.flows.status.skipped', 'Skipped'],
  cancelled: ['zotz.flows.status.cancelled', 'Cancelled']
}

/** Border and text classes per status, from the styleguide state tokens. */
export const ZOTZ_FLOW_STATUS_CLASS: Record<
  ZotzFlowNodeRunStatus,
  { border: string; chip: string }
> = {
  pending: { border: 'border-border', chip: 'bg-muted text-muted-foreground' },
  queued: { border: 'border-border border-dashed', chip: 'bg-muted text-muted-foreground' },
  running: { border: 'border-agent-working', chip: 'bg-agent-working/15 text-foreground' },
  waiting_approval: {
    border: 'border-agent-question',
    chip: 'bg-agent-question/15 text-agent-question-text'
  },
  done: {
    border: 'border-status-success-border',
    chip: 'bg-status-success-background text-status-success'
  },
  failed: { border: 'border-destructive', chip: 'bg-destructive/10 text-destructive' },
  skipped: { border: 'border-border border-dashed', chip: 'bg-muted text-muted-foreground' },
  cancelled: { border: 'border-border', chip: 'bg-muted text-muted-foreground' }
}

function clip(text: string, max = 60): string {
  const line = text.split('\n').find((part) => part.trim()) ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** One-line reminder of what a step does, shown under its name. */
export function zotzFlowNodeSummary(node: ZotzFlowNode, t: Translate): string {
  switch (node.kind) {
    case 'agent':
      return clip(node.prompt) || t('zotz.flows.summary.noPrompt', 'No prompt yet')
    case 'command':
      return clip(node.command) || t('zotz.flows.summary.noCommand', 'No command yet')
    case 'condition':
      return clip(`${node.value} ${node.operator} ${node.compareTo ?? ''}`.trim())
    case 'switch':
      return clip(node.value) || t('zotz.flows.summary.noValue', 'No value yet')
    case 'approval':
      return clip(node.message) || t('zotz.flows.summary.noMessage', 'No message yet')
    case 'wait':
      return node.wait.mode === 'duration'
        ? t('zotz.flows.summary.waitSeconds', '{seconds} s').replace(
            '{seconds}',
            String(node.wait.seconds)
          )
        : `${node.wait.time} ${node.wait.timezone}`
    case 'http':
      return clip(`${node.method} ${node.url}`)
    case 'notify':
      return clip(node.title)
    case 'chat_reply':
    case 'template':
      return clip(node.content) || t('zotz.flows.summary.noContent', 'No content yet')
    case 'subflow':
      return node.flowId ? '' : t('zotz.flows.summary.noFlow', 'No flow chosen')
    case 'for_each':
      return clip(node.items) || t('zotz.flows.summary.noItems', 'No list yet')
    case 'join':
      return node.waitFor === 'all'
        ? t('zotz.flows.summary.joinAll', 'Waits for all')
        : t('zotz.flows.summary.joinFirst', 'Waits for the first')
    case 'parallel':
      return ''
  }
}
