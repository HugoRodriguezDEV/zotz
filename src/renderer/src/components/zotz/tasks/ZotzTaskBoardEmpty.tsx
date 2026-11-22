import { SquareKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { useContextualTour } from '../../contextual-tours/use-contextual-tour'

/** The board before any source is picked: one way forward, and the tour that points at it. */
export function ZotzTaskBoardEmpty({
  active,
  onChooseSources
}: {
  active: boolean
  onChooseSources: () => void
}): React.JSX.Element {
  const t = useTranslate()
  useContextualTour('zotz-task-board-sources', active)
  return (
    <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
      <SquareKanban className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">
        {t('zotz.taskBoard.empty.title', 'No task sources yet')}
      </p>
      <p className="max-w-sm text-xs text-muted-foreground">
        {t(
          'zotz.taskBoard.empty.description',
          'Pick the GitHub organizations and projects, or connect a task service, whose tasks show up here.'
        )}
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-2"
        data-contextual-tour-target="zotz-task-sources-empty"
        onClick={onChooseSources}
      >
        {t('zotz.taskBoard.empty.action', 'Choose sources')}
      </Button>
    </div>
  )
}
