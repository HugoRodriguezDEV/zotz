import { ZotzWorkingBars } from '../sidebar/ZotzWorkingBars'
import type React from 'react'
import { GitPullRequest, Plus } from 'lucide-react'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { useZotzTourPhase } from './use-zotz-tour-phase'

type Task = { number: number; repo: string; title: string; project: string }

const PAYMENTS: Task = {
  number: 212,
  repo: 'acme/api',
  title: 'Card payments',
  project: 'Q4 launch'
}
const FILTER: Task = { number: 198, repo: 'acme/web', title: 'Date filter', project: 'Q4 launch' }
const DOCS: Task = { number: 87, repo: 'acme/docs', title: 'Setup guide', project: 'Docs' }

function TaskCard({
  task,
  highlighted,
  footer
}: {
  task: Task
  highlighted?: boolean
  footer?: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'space-y-1 rounded-md border border-border bg-card px-2 py-1.5 text-card-foreground transition-colors',
        highlighted && 'border-primary ring-1 ring-primary'
      )}
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <GitHubIcon className="size-3" />
        <span className="truncate">
          {task.repo}#{task.number} · {task.project}
        </span>
      </div>
      <div className="truncate text-xs font-medium">{task.title}</div>
      {footer}
    </div>
  )
}

function Column({
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

/** A task from a GitHub Project becomes a workspace, an agent picks it up and opens a PR. */
export function ZotzTaskBoardTourVisual({
  reducedMotion
}: {
  reducedMotion: boolean
}): React.JSX.Element {
  const t = useTranslate()
  // 0: board · 1: "Create workspace" on the task · 2: agent working · 3: its PR shows on the card.
  const phase = useZotzTourPhase(4, 1800, reducedMotion)
  const started = phase >= 2
  const prLine = (
    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <GitPullRequest className="size-3 shrink-0 text-status-success" />
      <span className="truncate">
        {t('zotz.taskBoard.pr.open', '→ {{base}} · PR open · {{ref}}', {
          base: 'main',
          ref: 'acme/web#534'
        })}
      </span>
    </div>
  )
  const payments = (
    <TaskCard
      task={PAYMENTS}
      highlighted={phase === 1 || phase === 2}
      footer={
        phase === 1 ? (
          <div className="flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
            <Plus className="size-3" />
            {t('zotz.tours.visual.tasks.createWorkspace', 'Create workspace with this task')}
          </div>
        ) : started ? (
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[11px] text-foreground">
              <ZotzWorkingBars />
              {t('zotz.tours.visual.tasks.agentWorking', 'Claude · working')}
            </span>
            {phase === 3 ? (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <GitPullRequest className="size-3 shrink-0" />
                <span className="truncate">
                  {t('zotz.taskBoard.pr.draft', '→ {{base}} · draft PR · {{ref}}', {
                    base: 'main',
                    ref: 'acme/api#61'
                  })}
                </span>
              </span>
            ) : null}
          </div>
        ) : null
      }
    />
  )
  return (
    <div className="flex w-full gap-2" aria-hidden>
      <Column title={t('zotz.tours.visual.tasks.todo', 'Todo')}>
        {started ? null : payments}
        <TaskCard task={DOCS} />
      </Column>
      <Column title={t('zotz.tours.visual.tasks.inProgress', 'In Progress')}>
        {started ? payments : null}
      </Column>
      <Column title={t('zotz.tours.visual.tasks.inReview', 'In Review')}>
        <TaskCard task={FILTER} footer={prLine} />
      </Column>
    </div>
  )
}
