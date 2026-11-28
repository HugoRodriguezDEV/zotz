import {
  Ban,
  Check,
  Circle,
  CircleSlash,
  Hand,
  Hourglass,
  Loader2,
  Workflow,
  X
} from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import type { Translate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { NativeChatMarkdown } from '@/components/native-chat/markdown/NativeChatMarkdown'
import { cn } from '@/lib/class-names'
import type { ZotzFlow } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import {
  isFinalZotzFlowRunStatus,
  type ZotzFlowNodeRun,
  type ZotzFlowNodeRunStatus,
  type ZotzFlowRun,
  type ZotzFlowRunStatus
} from '../../../../../shared/zotz/flows/zotz-flow-run-contract'

type Step = { id: string; name: string; nodeRun: ZotzFlowNodeRun | undefined }

/** Top-level steps in the flow's order; a step not reached yet shows as pending. */
function stepsOf(flow: ZotzFlow | null, run: ZotzFlowRun): Step[] {
  const top = new Map(
    run.nodes.filter((node) => node.iteration.length === 0).map((node) => [node.nodeId, node])
  )
  if (!flow) {
    return [...top.values()].map((nodeRun) => ({
      id: nodeRun.nodeId,
      name: nodeRun.nodeId,
      nodeRun
    }))
  }
  return flow.nodes
    .filter((node) => node.parentId === undefined)
    .map((node) => ({ id: node.id, name: node.name, nodeRun: top.get(node.id) }))
}

/** What `chat_reply` notes left in the chat, in step order (spec §6.3). */
function notesOf(flow: ZotzFlow | null, run: ZotzFlowRun): { id: string; text: string }[] {
  return (flow?.nodes ?? []).flatMap((node) => {
    const nodeRun = run.nodes.find(
      (entry) => entry.nodeId === node.id && entry.iteration.length === 0
    )
    const text = nodeRun?.status === 'done' ? nodeRun.output?.markdown : null
    return node.kind === 'chat_reply' && node.mode === 'note' && text ? [{ id: node.id, text }] : []
  })
}

function runStatusLabel(status: ZotzFlowRunStatus, t: Translate): string {
  switch (status) {
    case 'queued':
      return t('zotz.flowChat.status.queued', 'Waiting to start')
    case 'running':
      return t('zotz.flowChat.status.running', 'Running')
    case 'waiting_approval':
      return t('zotz.flowChat.status.waitingApproval', 'Waiting for approval')
    case 'done':
      return t('zotz.flowChat.status.done', 'Done')
    case 'failed':
      return t('zotz.flowChat.status.failed', 'Failed')
    case 'skipped':
      return t('zotz.flowChat.status.skipped', 'Not run')
    case 'cancelled':
      return t('zotz.flowChat.status.cancelled', 'Cancelled')
  }
}

function stepStatusLabel(status: ZotzFlowNodeRunStatus, t: Translate): string {
  switch (status) {
    case 'pending':
      return t('zotz.flowChat.step.pending', 'Pending')
    case 'queued':
      return t('zotz.flowChat.step.queued', 'In the agent queue')
    case 'running':
      return t('zotz.flowChat.status.running', 'Running')
    case 'waiting_approval':
      return t('zotz.flowChat.status.waitingApproval', 'Waiting for approval')
    case 'done':
      return t('zotz.flowChat.status.done', 'Done')
    case 'failed':
      return t('zotz.flowChat.status.failed', 'Failed')
    case 'skipped':
      return t('zotz.flowChat.step.skipped', 'Skipped')
    case 'cancelled':
      return t('zotz.flowChat.status.cancelled', 'Cancelled')
  }
}

function StepIcon({ status }: { status: ZotzFlowNodeRunStatus }): React.JSX.Element {
  switch (status) {
    case 'running':
      return <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
    case 'queued':
      return <Hourglass className="size-4" />
    case 'waiting_approval':
      return <Hand className="size-4 text-chat-warning" />
    case 'done':
      return <Check className="size-4" />
    case 'failed':
      return <X className="size-4 text-destructive" />
    case 'skipped':
      return <CircleSlash className="size-4" />
    case 'cancelled':
      return <Ban className="size-4" />
    case 'pending':
      return <Circle className="size-4" />
  }
}

function stepDetail(nodeRun: ZotzFlowNodeRun | undefined, t: Translate): string | null {
  if (!nodeRun) {
    return null
  }
  if (nodeRun.loop) {
    const finished = nodeRun.loop.iterations.filter((it) => it.status === 'done').length
    const failed = nodeRun.loop.iterations.filter((it) => it.status === 'failed').length
    return failed > 0
      ? t('zotz.flowChat.loopProgressFailed', '{{done}}/{{total}} · {{failed}} failed', {
          done: finished,
          total: nodeRun.loop.total,
          failed
        })
      : t('zotz.flowChat.loopProgress', '{{done}}/{{total}}', {
          done: finished,
          total: nodeRun.loop.total
        })
  }
  return nodeRun.status === 'failed' || nodeRun.status === 'skipped' ? nodeRun.error : null
}

/** A flow a chat fired, as a card in that chat: each step's live state, its notes and the run's end. */
export function ZotzFlowChatRunCard({
  flow,
  run,
  machineLabel,
  onOpenRun,
  onCancel
}: {
  flow: ZotzFlow | null
  run: ZotzFlowRun
  /** The server's name when the flow runs on another machine; absent for this one. */
  machineLabel?: string
  /** Absent until the Flows page can show one run. */
  onOpenRun?: () => void
  onCancel?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const final = isFinalZotzFlowRunStatus(run.status)
  const steps = stepsOf(flow, run)
  const notes = notesOf(flow, run)
  const name = flow?.name ?? t('zotz.flowChat.deletedFlow', 'Deleted flow')
  return (
    <div className="px-3 pb-2 sm:px-4" data-zotz-flow-chat-run={run.id}>
      <section
        aria-label={t('zotz.flowChat.cardLabel', 'Flow {{flow}}', { flow: name })}
        className="flex w-full max-w-xl flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xs"
      >
        <header className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
            <Workflow className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-sm font-medium break-words text-foreground">{name}</div>
            <div className="text-xs text-muted-foreground">
              {machineLabel
                ? t('zotz.flowChat.runOn', 'Run #{{number}} on {{machine}}', {
                    number: run.runNumber,
                    machine: machineLabel
                  })
                : t('zotz.flowChat.runNumber', 'Run #{{number}}', { number: run.runNumber })}
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium',
              run.status === 'failed' ? 'text-destructive' : 'text-foreground'
            )}
          >
            {runStatusLabel(run.status, t)}
          </span>
        </header>
        {steps.length > 0 ? (
          <ol className="space-y-1.5">
            {steps.map((step) => {
              const status = step.nodeRun?.status ?? 'pending'
              const unreached = final && !step.nodeRun
              const detail = stepDetail(step.nodeRun, t)
              return (
                <li key={step.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={cn(
                      'mt-0.5 shrink-0',
                      status === 'pending' || status === 'skipped'
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                    )}
                  >
                    <StepIcon status={unreached ? 'skipped' : status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium break-words text-foreground">{step.name}</span>
                    <span className="text-muted-foreground">
                      {' · '}
                      {unreached
                        ? t('zotz.flowChat.step.notReached', 'Not reached')
                        : stepStatusLabel(status, t)}
                    </span>
                    {detail ? (
                      <p
                        className={cn(
                          'line-clamp-3 break-words',
                          status === 'failed'
                            ? 'text-sm text-destructive'
                            : 'text-xs text-muted-foreground'
                        )}
                      >
                        {detail}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        ) : null}
        {notes.map((note) => (
          <div
            key={note.id}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            data-zotz-flow-chat-note={note.id}
          >
            <NativeChatMarkdown content={note.text} />
          </div>
        ))}
        {run.status === 'failed' && run.error && !steps.some((s) => s.nodeRun?.error) ? (
          <p className="text-sm break-words text-destructive">{run.error}</p>
        ) : null}
        {onOpenRun || (onCancel && !final) ? (
          <div className="flex flex-wrap gap-2">
            {onOpenRun ? (
              <Button size="sm" variant="outline" onClick={onOpenRun}>
                {t('zotz.flowChat.openRun', 'View run')}
              </Button>
            ) : null}
            {onCancel && !final ? (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                {t('zotz.flowChat.cancelRun', 'Stop flow')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
