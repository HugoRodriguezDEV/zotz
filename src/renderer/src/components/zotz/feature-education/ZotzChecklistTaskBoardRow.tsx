import type React from 'react'
import { Kanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { countZotzTaskBoardSources } from '../../../../../shared/zotz/tasks/zotz-task-board-source-count'
import { openZotzBoard } from '../tasks/zotz-board-page-store'

/** Getting Started's task step: the Zotz board comes first, the per-provider rows below it. */
export function ZotzChecklistTaskBoardRow(): React.JSX.Element {
  const t = useTranslate()
  const count = useAppStore((s) => countZotzTaskBoardSources(s.settings))
  const closeModal = useAppStore((s) => s.closeModal)
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <Kanban className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">
          {t('zotz.tours.checklist.taskBoard.title', 'Task board')}
        </div>
        <div className="text-xs text-muted-foreground">
          {count > 0
            ? t('zotz.tours.featureWall.tasks.sources', '{{count}} sources on your board.', {
                count
              })
            : t(
                'zotz.tours.featureWall.tasks.noSources',
                'Pick your GitHub Projects, repos or a task service to fill the board.'
              )}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={count > 0 ? 'outline' : 'default'}
        onClick={() => {
          closeModal()
          openZotzBoard()
        }}
      >
        {t('zotz.tours.featureWall.tasks.action', 'Open the task board')}
      </Button>
    </div>
  )
}
