import { ZotzWorkingBars } from '../sidebar/ZotzWorkingBars'
import type React from 'react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { ZotzAgentQueueSnapshot } from '../../../../../shared/zotz/agent-queue/zotz-agent-queue-snapshot'
import type { ZotzAgentQueueMachine } from '../agent-queue/ZotzAgentQueueBoard'
import { MemoryRows } from '../agent-queue/ZotzAgentQueueMemoryRows'
import { useZotzTourPhase } from './use-zotz-tour-phase'

const GB = 1024 ** 3
const noop = (): void => {}

type Running = ZotzAgentQueueSnapshot['running'][number]

const running = (paneKey: string, agent: Running['agent'], worktreeId: string, gb: number) =>
  ({
    paneKey,
    agent,
    state: 'working',
    worktreeId,
    bytes: gb * GB,
    peakBytes: gb * GB,
    startedAt: 0
  }) satisfies Running

function machine(
  hostId: ZotzAgentQueueMachine['hostId'],
  name: string,
  totalGb: number,
  freeGb: number,
  agents: Running[]
): ZotzAgentQueueMachine {
  return {
    hostId,
    name,
    isThisDevice: hostId === 'local',
    onCancel: noop,
    onForceStart: noop,
    snapshot: {
      memory: {
        totalBytes: totalGb * GB,
        availableBytes: freeGb * GB,
        pressure: 'ok',
        minFreeBytes: totalGb * 0.15 * GB,
        perAgentMaxBytes: 6 * GB,
        sampledAt: 0
      },
      running: agents,
      done: [],
      canceled: [],
      queued: []
    }
  }
}

const LAPTOP = machine('local', 'Local Mac', 24, 12.5, [running('m1', 'claude', 'zotz-docs', 2.4)])
const FIX_CI = running('s1', 'codex', 'fix-ci', 5.2)
const REFACTOR = running('s2', 'claude', 'refactor-auth', 2.4)
const PAYMENTS = running('s3', 'claude', 'api-payments', 3)

// 0: payments waits for memory · 1: fix-ci finishes and frees it · 2: payments starts on its own.
const SERVER_BY_PHASE = [
  machine('runtime:msi', 'MSI Server', 16, 1.6, [FIX_CI, REFACTOR]),
  machine('runtime:msi', 'MSI Server', 16, 6.8, [REFACTOR]),
  machine('runtime:msi', 'MSI Server', 16, 3.8, [REFACTOR, PAYMENTS])
]

function Lane({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg bg-muted/60 p-2">
      <div className="px-1 text-[11px] font-semibold text-foreground">{title}</div>
      {children}
    </div>
  )
}

function Card({
  agent,
  name,
  detail,
  highlighted,
  working
}: {
  agent: string
  name: string
  detail: string
  highlighted?: boolean
  working?: boolean
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card px-2 py-1.5 text-card-foreground transition-colors',
        highlighted && 'border-primary ring-1 ring-primary'
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {working ? <ZotzWorkingBars /> : null}
        <span className="truncate">
          {agent} · {name}
        </span>
      </div>
      <div className="truncate text-[11px] text-muted-foreground">{detail}</div>
    </div>
  )
}

/** The server runs out of room, a launch waits in Backlog, and starts once an agent finishes. */
export function ZotzQueueTourVisual({
  reducedMotion
}: {
  reducedMotion: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const phase = useZotzTourPhase(SERVER_BY_PHASE.length, 2200, reducedMotion)
  const server = SERVER_BY_PHASE[phase]
  const waiting = phase === 0
  const msi = 'MSI Server'
  return (
    <div className="flex w-full flex-col gap-3" aria-hidden>
      <MemoryRows queues={[LAPTOP, server]} />
      <div className="flex gap-2">
        <Lane title={t('zotz.agentQueue.board.backlog', 'Backlog')}>
          {waiting ? (
            <Card
              agent="Claude"
              name="api-payments"
              detail={t('zotz.tours.visual.queue.needsMemory', 'Needs 3 GB · waits for memory')}
              highlighted
            />
          ) : (
            <div className="px-1 py-2 text-center text-[11px] text-muted-foreground">
              {t('zotz.agentQueue.board.backlogEmpty', 'Nothing waiting')}
            </div>
          )}
        </Lane>
        <Lane title={t('zotz.agentQueue.board.inProgress', 'In Progress')}>
          {phase === 0 ? <Card agent="Codex" name="fix-ci" detail={msi} working /> : null}
          <Card agent="Claude" name="refactor-auth" detail={msi} working />
          {phase === 2 ? (
            <Card
              agent="Claude"
              name="api-payments"
              detail={t('zotz.tours.visual.queue.startedOnItsOwn', 'Started on its own')}
              highlighted
              working
            />
          ) : null}
        </Lane>
        <Lane title={t('zotz.agentQueue.board.done', 'Done')}>
          {phase > 0 ? <Card agent="Codex" name="fix-ci" detail={msi} /> : null}
        </Lane>
      </div>
    </div>
  )
}
