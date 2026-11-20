import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { ZotzTaskBoardArchivedTask } from '../../../../../shared/zotz/tasks/zotz-task-board-types'

/** Tasks hidden by "Archive finished", newest first, each with a way back to the board. */
export function ZotzTaskArchivedList({
  archived,
  onBack,
  onRestore
}: {
  archived: ZotzTaskBoardArchivedTask[]
  onBack: () => void
  onRestore: (key: string) => void
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scrollbar-sleek">
      <Button variant="ghost" size="sm" type="button" className="self-start" onClick={onBack}>
        <ArrowLeft className="size-3.5" />
        {t('zotz.taskBoard.backToBoard', 'Back to the board')}
      </Button>
      {archived.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">
          {t('zotz.taskBoard.archivedEmpty', 'Nothing archived yet.')}
        </p>
      ) : (
        [...archived]
          .sort((a, b) => b.archivedAt - a.archivedAt)
          .map((entry) => (
            <div
              key={entry.key}
              className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-xs"
            >
              <span className="min-w-0 flex-1 truncate">{entry.title}</span>
              <span className="shrink-0 text-muted-foreground">
                {new Date(entry.archivedAt).toLocaleDateString(locale)}
              </span>
              <Button variant="ghost" size="xs" type="button" onClick={() => onRestore(entry.key)}>
                {t('zotz.taskBoard.restore', 'Restore')}
              </Button>
            </div>
          ))
      )}
    </div>
  )
}
