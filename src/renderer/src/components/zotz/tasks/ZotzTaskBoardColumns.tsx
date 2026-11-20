import { Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import {
  chipStyle,
  singleSelectChipColors
} from '../../github-project/cells/project-cell-chip-colors'
import {
  ZOTZ_TASK_BOARD_COLUMNS,
  type ZotzTaskBoard,
  type ZotzTaskBoardItem
} from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import { ZotzTaskCard } from './ZotzTaskCard'

const COLUMN_WIDTH_PX = 260

function translatedColumnLabel(id: string, label: string, t: ReturnType<typeof useTranslate>) {
  switch (id) {
    case 'backlog':
      return t('zotz.taskBoard.column.backlog', 'Backlog')
    case 'in-progress':
      return t('zotz.taskBoard.column.inProgress', 'In Progress')
    case 'in-review':
      return t('zotz.taskBoard.column.inReview', 'In Review')
    case 'done':
      return t('zotz.taskBoard.column.done', 'Done')
    default:
      return label
  }
}

function TaskColumn({
  label,
  color,
  items,
  action,
  onOpen
}: {
  label: string
  color: string | null
  items: ZotzTaskBoardItem[]
  action?: React.ReactNode
  onOpen: (item: ZotzTaskBoardItem) => void
}): React.JSX.Element {
  const colors = color ? singleSelectChipColors(color) : null
  return (
    <div
      role="list"
      aria-label={label}
      className="flex h-full min-h-0 shrink-0 flex-col rounded-lg border border-border/50 bg-muted/20"
      style={{ width: COLUMN_WIDTH_PX }}
    >
      <div className="flex h-9 flex-none items-center gap-1.5 px-2.5 text-xs">
        {colors ? (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-[var(--github-project-chip-fg-light)] dark:bg-[var(--github-project-chip-fg-dark)]"
            style={{ ...chipStyle(colors), boxShadow: `0 0 0 3px ${colors.bg}` }}
          />
        ) : null}
        <span className="truncate font-medium">{label}</span>
        <span className="rounded-full border border-border/50 bg-background px-1.5 text-[11px] text-muted-foreground">
          {items.length}
        </span>
        <div className="ml-auto">{action}</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2 scrollbar-sleek">
        {items.map((item) => (
          <ZotzTaskCard key={item.key} item={item} onOpen={() => onOpen(item)} />
        ))}
      </div>
    </div>
  )
}

/** The combined board: Zotz's own Status columns, plus "No Status" for unmatched options. */
export function ZotzTaskBoardColumns({
  board,
  onOpen,
  onArchiveDone
}: {
  board: ZotzTaskBoard
  onOpen: (item: ZotzTaskBoardItem) => void
  onArchiveDone: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-1 scrollbar-sleek">
      {ZOTZ_TASK_BOARD_COLUMNS.map((column) => (
        <TaskColumn
          key={column.id}
          label={translatedColumnLabel(column.id, column.label, t)}
          color={column.color}
          items={board.columns[column.id]}
          onOpen={onOpen}
          action={
            column.id === 'done' && board.columns.done.length > 0 ? (
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={onArchiveDone}
                className="text-muted-foreground"
              >
                <Archive className="size-3" />
                {t('zotz.taskBoard.archiveDone', 'Archive finished')}
              </Button>
            ) : null
          }
        />
      ))}
      {board.unmapped.length > 0 ? (
        <TaskColumn
          label={t('zotz.taskBoard.column.noStatus', 'No Status')}
          color={null}
          items={board.unmapped}
          onOpen={onOpen}
        />
      ) : null}
    </div>
  )
}
