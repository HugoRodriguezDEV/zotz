import { useMemo, useState } from 'react'
import { Archive, ArrowLeft, RefreshCw, Settings2, SquareKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { getIntlLocale } from '@/i18n/i18n'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store/index'
import ProjectBoard from '../../github-project/board/ProjectBoard'
import type {
  GitHubProjectRow,
  GitHubProjectTable
} from '../../../../../shared/github/projects/project-types'
import {
  buildZotzTaskBoard,
  type ZotzTaskBoardItem
} from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import {
  readZotzTaskBoardArchived,
  zotzTaskBoardSourceKey
} from '../../../../../shared/zotz/tasks/zotz-task-board-types'
import { closeZotzBoard } from './zotz-board-modal-store'
import { useZotzTaskBoardData } from './use-zotz-task-board-data'
import { ZotzTaskBoardColumns } from './ZotzTaskBoardColumns'
import { ZotzTaskDetailSheet, type ZotzTaskDetail } from './ZotzTaskDetailSheet'
import { ZOTZ_TASK_BOARD_SOURCES_SECTION_ID } from './ZotzTaskBoardSourcesSetting'

const ALL_VIEW = 'all'

function matchesQuery(
  row: GitHubProjectRow,
  project: GitHubProjectTable['project'],
  query: string
) {
  if (!query) {
    return true
  }
  const haystack = [
    row.content.title,
    row.content.number == null ? '' : `#${row.content.number}`,
    row.content.repository ?? '',
    project.title,
    project.owner
  ]
    .join(' ')
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term))
}

function filterTable(table: GitHubProjectTable, query: string): GitHubProjectTable {
  return query
    ? { ...table, rows: table.rows.filter((row) => matchesQuery(row, table.project, query)) }
    : table
}

function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
      <SquareKanban className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

/** The Tasks tab: GitHub Projects merged into Zotz's columns, or one project exactly as GitHub shows it. */
export function ZotzTaskBoard({ active }: { active: boolean }): React.JSX.Element {
  const t = useTranslate()
  const { sources, states, lastUpdatedAt, refreshing, refresh } = useZotzTaskBoardData(active)
  const rawArchived = useAppStore((s) => s.settings?.zotzTaskBoardArchived)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const [view, setView] = useState(ALL_VIEW)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [detail, setDetail] = useState<ZotzTaskDetail | null>(null)

  const archived = useMemo(() => readZotzTaskBoardArchived(rawArchived), [rawArchived])
  const tables = useMemo(
    () => states.flatMap((state) => (state.table ? [filterTable(state.table, query.trim())] : [])),
    [query, states]
  )
  const tablesByProjectId = useMemo(
    () => new Map(tables.map((table) => [table.project.id, table])),
    [tables]
  )
  const board = useMemo(
    () => buildZotzTaskBoard(tables, new Set(archived.map((entry) => entry.key))),
    [archived, tables]
  )
  const mirrorState =
    view === ALL_VIEW ? null : states.find((state) => zotzTaskBoardSourceKey(state.source) === view)

  const openSourceSettings = (): void => {
    closeZotzBoard()
    openSettingsTarget({
      pane: 'tasks',
      repoId: null,
      sectionId: ZOTZ_TASK_BOARD_SOURCES_SECTION_ID
    })
    openSettingsPage()
  }
  const openItem = (item: ZotzTaskBoardItem): void => {
    const table = tablesByProjectId.get(item.project.id)
    if (table) {
      setDetail({ row: item.row, table })
    }
  }
  const archiveDone = (): void => {
    const known = new Set(archived.map((entry) => entry.key))
    const now = Date.now()
    const added = board.columns.done
      .filter((item) => !known.has(item.key))
      .map((item) => ({ key: item.key, title: item.row.content.title, archivedAt: now }))
    if (added.length > 0) {
      updateSettings({ zotzTaskBoardArchived: [...archived, ...added] })
    }
  }
  const restore = (key: string): void => {
    updateSettings({ zotzTaskBoardArchived: archived.filter((entry) => entry.key !== key) })
  }

  if (sources.length === 0) {
    return (
      <EmptyState
        title={t('zotz.taskBoard.empty.title', 'No task sources yet')}
        description={t(
          'zotz.taskBoard.empty.description',
          'Pick the GitHub organizations and projects whose tasks show up here.'
        )}
        action={
          <Button type="button" size="sm" className="mt-2" onClick={openSourceSettings}>
            {t('zotz.taskBoard.empty.action', 'Choose projects')}
          </Button>
        }
      />
    )
  }

  const errors = states.filter((state) => state.error)
  const firstLoad = tables.length === 0 && refreshing

  return (
    <div className="flex h-[min(68vh,640px)] min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={view} onValueChange={setView}>
          <SelectTrigger size="sm" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VIEW}>{t('zotz.taskBoard.view.all', 'All projects')}</SelectItem>
            {sources.map((source) => (
              <SelectItem
                key={zotzTaskBoardSourceKey(source)}
                value={zotzTaskBoardSourceKey(source)}
              >
                {source.owner} / {source.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('zotz.taskBoard.search', 'Search tasks')}
          className="h-8 w-56"
        />
        <div className="ml-auto flex items-center gap-1">
          {lastUpdatedAt ? (
            <span className="text-xs text-muted-foreground">
              {t('zotz.taskBoard.updatedAt', 'Updated {{time}}', {
                time: new Date(lastUpdatedAt).toLocaleTimeString(getIntlLocale(), {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              })}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={t('zotz.taskBoard.refresh', 'Refresh')}
            title={t('zotz.taskBoard.refresh', 'Refresh')}
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          </Button>
          <Button
            variant={showArchived ? 'secondary' : 'ghost'}
            size="sm"
            type="button"
            onClick={() => setShowArchived((value) => !value)}
          >
            <Archive className="size-3.5" />
            {t('zotz.taskBoard.archived', 'Archived ({{total}})', { total: archived.length })}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={t('zotz.taskBoard.manageSources', 'Choose projects')}
            title={t('zotz.taskBoard.manageSources', 'Choose projects')}
            onClick={openSourceSettings}
          >
            <Settings2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {errors.map((state) => (
        <div
          key={zotzTaskBoardSourceKey(state.source)}
          className="rounded-md border border-status-warning-border bg-status-warning-background px-3 py-2 text-xs text-muted-foreground"
        >
          {t('zotz.taskBoard.sourceError', "Couldn't load {{project}}: {{error}}", {
            project: `${state.source.owner} / ${state.source.title}`,
            error: state.error
          })}
        </div>
      ))}

      {showArchived ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scrollbar-sleek">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="self-start"
            onClick={() => setShowArchived(false)}
          >
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
                    {new Date(entry.archivedAt).toLocaleDateString(getIntlLocale())}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    type="button"
                    onClick={() => restore(entry.key)}
                  >
                    {t('zotz.taskBoard.restore', 'Restore')}
                  </Button>
                </div>
              ))
          )}
        </div>
      ) : firstLoad ? (
        <p className="px-2 py-6 text-xs text-muted-foreground">
          {t('zotz.taskBoard.loading', 'Loading tasks…')}
        </p>
      ) : mirrorState ? (
        mirrorState.table ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/50">
            <ProjectBoard
              table={filterTable(mirrorState.table, query.trim())}
              onOpenDialog={(row) => {
                if (mirrorState.table) {
                  setDetail({ row, table: mirrorState.table })
                }
              }}
              fallback={
                <p className="p-3 text-xs text-muted-foreground">
                  {t(
                    'zotz.taskBoard.mirrorNoColumns',
                    'This project view has no Status or iteration field to make columns from.'
                  )}
                </p>
              }
            />
          </div>
        ) : null
      ) : (
        <ZotzTaskBoardColumns board={board} onOpen={openItem} onArchiveDone={archiveDone} />
      )}

      <ZotzTaskDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
