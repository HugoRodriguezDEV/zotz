import { countZotzTaskBoardSources } from '../../../../../shared/zotz/tasks/zotz-task-board-source-count'
import type React from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { resolveZotzMachineMode } from '../../../../../shared/zotz/zotz-machine-mode'
import { isZotzMachineModeHost, openZotzMachineModeWizard } from '../zotz-machine-mode-wizard-event'
import { setZotzAgentQueueDrawerOpen } from '../agent-queue/zotz-agent-queue-drawer-open'
import { openZotzBoard } from '../tasks/zotz-board-page-store'
import { ZotzNodeTourVisual } from './ZotzNodeTourVisual'
import { ZotzQueueTourVisual } from './ZotzQueueTourVisual'
import { ZotzTaskBoardTourVisual } from './ZotzTaskBoardTourVisual'

export type ZotzFeatureWallBodyId = 'zotz-node' | 'zotz-queue' | 'tasks'

/** Returns the id when Zotz owns this workflow's body; not a type guard, so callers keep their union. */
export function zotzFeatureWallBodyId(id: string): ZotzFeatureWallBodyId | null {
  return id === 'zotz-node' || id === 'zotz-queue' || id === 'tasks' ? id : null
}

function SetupCard({
  status,
  action,
  onAction
}: {
  status: string
  action: string | null
  onAction: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
      <p className="min-w-0 text-[13px] leading-snug text-muted-foreground">{status}</p>
      {action ? (
        <Button type="button" size="sm" className="shrink-0" onClick={onAction}>
          {action}
          <ArrowRight className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}

function NodeSetup({ close }: { close: () => void }): React.JSX.Element {
  const t = useTranslate()
  const mode = useAppStore((s) => resolveZotzMachineMode(s.settings))
  if (!isZotzMachineModeHost()) {
    return (
      <SetupCard
        status={t(
          'zotz.tours.featureWall.node.remoteClient',
          'Set up server mode on the machine itself; this window belongs to another computer.'
        )}
        action={null}
        onAction={close}
      />
    )
  }
  const status =
    mode === 'server'
      ? t(
          'zotz.tours.featureWall.node.isServer',
          'This machine is a remote server. Run the setup again to see its access link or fix a step.'
        )
      : mode === 'personal'
        ? t(
            'zotz.tours.featureWall.node.isPersonal',
            'This machine is personal. Pair it with your server to send it work, or turn this one into the server.'
          )
        : t(
            'zotz.tours.featureWall.node.isUnset',
            'Choose whether this machine is personal or the always-on server.'
          )
  return (
    <SetupCard
      status={status}
      action={t('zotz.tours.featureWall.node.action', 'Set up this machine')}
      onAction={() => {
        close()
        openZotzMachineModeWizard()
      }}
    />
  )
}

function TasksSetup({ close }: { close: () => void }): React.JSX.Element {
  const t = useTranslate()
  const count = useAppStore((s) => countZotzTaskBoardSources(s.settings))
  return (
    <SetupCard
      status={
        count > 0
          ? t('zotz.tours.featureWall.tasks.sources', '{{count}} sources on your board.', { count })
          : t(
              'zotz.tours.featureWall.tasks.noSources',
              'Pick your GitHub Projects, repos or a task service to fill the board.'
            )
      }
      action={t('zotz.tours.featureWall.tasks.action', 'Open the task board')}
      onAction={() => {
        close()
        openZotzBoard()
      }}
    />
  )
}

/** Gallery body for what Zotz adds: an animated storyboard plus one way to try it right away. */
export function ZotzFeatureWallBody({
  id,
  reducedMotion
}: {
  id: ZotzFeatureWallBodyId
  reducedMotion: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const close = useAppStore((s) => s.closeModal)
  return (
    <div className="flex min-h-full flex-col gap-4 px-8 pb-0 pt-1">
      <div className="flex h-[300px] w-full items-center justify-center">
        <div className="w-[600px] max-w-full">
          {id === 'zotz-node' ? (
            <ZotzNodeTourVisual reducedMotion={reducedMotion} />
          ) : id === 'zotz-queue' ? (
            <ZotzQueueTourVisual reducedMotion={reducedMotion} />
          ) : (
            <ZotzTaskBoardTourVisual reducedMotion={reducedMotion} />
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[560px]">
        {id === 'zotz-node' ? (
          <NodeSetup close={close} />
        ) : id === 'zotz-queue' ? (
          <SetupCard
            status={t(
              'zotz.tours.featureWall.queue.status',
              'The status bar shows free memory; click it any time to see every machine’s queue.'
            )}
            action={t('zotz.tours.featureWall.queue.action', 'Open the queue')}
            onAction={() => {
              close()
              setZotzAgentQueueDrawerOpen(true)
            }}
          />
        ) : (
          <TasksSetup close={close} />
        )}
      </div>
    </div>
  )
}
