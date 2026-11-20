import { useMemo, useState } from 'react'
import { Archive, RefreshCw, Settings2, SquareKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store/index'
import ProjectBoard from '../../github-project/board/ProjectBoard'
import {
  buildZotzTaskBoard,
  zotzTaskKey,
  type ZotzExternalTaskSource,
  type ZotzTaskBoardItem
} from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import {
  readZotzTaskBoardArchived,
  zotzTaskBoardSourceKey
} from '../../../../../shared/zotz/tasks/zotz-task-board-types'
import { closeZotzBoard } from './zotz-board-modal-store'
import { useZotzTaskBoardData } from './use-zotz-task-board-data'
import { useZotzTaskConnectors } from './use-zotz-task-connectors'
import { ZotzTaskBoardColumns, ZotzTaskColumns } from './ZotzTaskBoardColumns'
import { ZotzTaskDetailSheet, type ZotzTaskDetail } from './ZotzTaskDetailSheet'
import { ZotzTaskArchivedList } from './ZotzTaskArchivedList'
import { ZOTZ_TASK_BOARD_SOURCES_SECTION_ID } from './ZotzTaskBoardSourcesSetting'
import {
  externalSourceColumns,
  filterExternalSource,
  filterTable
} from './zotz-task-board-filtering'

const ALL_VIEW = 'all'
const EXTERNAL_VIEW_PREFIX = 'external:'

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

/**
 * The Tasks tab: GitHub Projects and external services merged into Zotz's columns, or one
 * source exactly as it shows itself.
 */
export function ZotzTaskBoard({ active }: { active: boolean }): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  const github = useZotzTaskBoardData(active)
  const external = useZotzTaskConnectors(active)
  const rawArchived = useAppStore((s) => s.settings?.zotzTaskBoardArchived)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const [view, setView] = useState(ALL_VIEW)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [detail, setDetail] = useState<ZotzTaskDetail | null>(null)

  const trimmedQuery = query.trim()
  const archived = useMemo(() => readZotzTaskBoardArchived(rawArchived), [rawArchived])
  const tables = useMemo(
    () =>
      github.states.flatMap((state) =>
        state.table ? [filterTable(state.table, trimmedQuery)] : []
      ),
    [github.states, trimmedQuery]
  )
  const externalSources = useMemo(
    () =>
      external.states.flatMap(({ connector, snapshot }): ZotzExternalTaskSource[] =>
        snapshot?.document
          ? [
              filterExternalSource(
                { connectorId: connector.id, document: snapshot.document },
                trimmedQuery
              )
            ]
          : []
      ),
    [external.states, trimmedQuery]
  )
  const tablesByProjectId = useMemo(
    () => new Map(tables.map((table) => [table.project.id, table])),
    [tables]
  )
  const board = useMemo(
    () => buildZotzTaskBoard(tables, new Set(archived.map((entry) => entry.key)), externalSources),
    [archived, externalSources, tables]
  )
  const githubMirror = github.states.find((state) => zotzTaskBoardSourceKey(state.source) === view)
  const externalMirror = view.startsWith(EXTERNAL_VIEW_PREFIX)
    ? externalSources.find(
        (source) => source.connectorId === view.slice(EXTERNAL_VIEW_PREFIX.length)
      )
    : undefined
  const refreshing = github.refreshing || external.refreshing

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
    setDetail(
      item.origin.kind === 'github'
        ? { item, table: tablesByProjectId.get(item.origin.project.id) }
        : { item }
    )
  }
  const archiveDone = (): void => {
    const known = new Set(archived.map((entry) => entry.key))
    const now = Date.now()
    const added = board.columns.done
      .filter((item) => !known.has(item.key))
      .map((item) => ({ key: item.key, title: item.title, archivedAt: now }))
    if (added.length > 0) {
      updateSettings({ zotzTaskBoardArchived: [...archived, ...added] })
    }
  }

  if (github.sources.length === 0 && external.states.length === 0) {
    return (
      <EmptyState
        title={t('zotz.taskBoard.empty.title', 'No task sources yet')}
        description={t(
          'zotz.taskBoard.empty.description',
          'Pick the GitHub organizations and projects, or connect a task service, whose tasks show up here.'
        )}
        action={
          <Button type="button" size="sm" className="mt-2" onClick={openSourceSettings}>
            {t('zotz.taskBoard.empty.action', 'Choose sources')}
          </Button>
        }
      />
    )
  }

  const errors = [
    ...github.states.flatMap((state) =>
      state.error
        ? [
            {
              key: zotzTaskBoardSourceKey(state.source),
              name: `${state.source.owner} / ${state.source.title}`,
              error: state.error
            }
          ]
        : []
    ),
    ...external.states.flatMap(({ connector, snapshot }) =>
      snapshot?.error
        ? [
            {
              key: connector.id,
              name: snapshot.document?.source.name ?? connector.name,
              error: snapshot.error
            }
          ]
        : []
    )
  ]
  const firstLoad = tables.length === 0 && externalSources.length === 0 && refreshing

  return (
    <div className="flex h-[min(68vh,640px)] min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={view} onValueChange={setView}>
          <SelectTrigger size="sm" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VIEW}>{t('zotz.taskBoard.view.all', 'All projects')}</SelectItem>
            {github.sources.map((source) => (
              <SelectItem
                key={zotzTaskBoardSourceKey(source)}
                value={zotzTaskBoardSourceKey(source)}
              >
                {source.owner} / {source.title}
              </SelectItem>
            ))}
            {external.states.map(({ connector, snapshot }) => (
              <SelectItem key={connector.id} value={`${EXTERNAL_VIEW_PREFIX}${connector.id}`}>
                {snapshot?.document?.source.name ?? connector.name}
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
          {github.lastUpdatedAt ? (
            <span className="text-xs text-muted-foreground">
              {t('zotz.taskBoard.updatedAt', 'Updated {{time}}', {
                time: new Date(github.lastUpdatedAt).toLocaleTimeString(locale, {
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
            onClick={() => {
              github.refresh()
              external.refresh()
            }}
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
            aria-label={t('zotz.taskBoard.manageSources', 'Choose sources')}
            title={t('zotz.taskBoard.manageSources', 'Choose sources')}
            onClick={openSourceSettings}
          >
            <Settings2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {errors.map((error) => (
        <div
          key={error.key}
          className="rounded-md border border-status-warning-border bg-status-warning-background px-3 py-2 text-xs text-muted-foreground"
        >
          {t('zotz.taskBoard.sourceError', "Couldn't load {{project}}: {{error}}", {
            project: error.name,
            error: error.error
          })}
        </div>
      ))}

      {showArchived ? (
        <ZotzTaskArchivedList
          archived={archived}
          onBack={() => setShowArchived(false)}
          onRestore={(key) =>
            updateSettings({ zotzTaskBoardArchived: archived.filter((entry) => entry.key !== key) })
          }
        />
      ) : firstLoad ? (
        <p className="px-2 py-6 text-xs text-muted-foreground">
          {t('zotz.taskBoard.loading', 'Loading tasks…')}
        </p>
      ) : githubMirror ? (
        githubMirror.table ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/50">
            <ProjectBoard
              table={filterTable(githubMirror.table, trimmedQuery)}
              onOpenDialog={(row) => {
                const table = githubMirror.table
                if (table) {
                  setDetail({
                    item: {
                      key: zotzTaskKey(table.project, row),
                      title: row.content.title,
                      statusName: null,
                      column: null,
                      origin: { kind: 'github', row, project: table.project }
                    },
                    table
                  })
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
      ) : externalMirror ? (
        <ZotzTaskColumns columns={externalSourceColumns(externalMirror)} onOpen={openItem} />
      ) : (
        <ZotzTaskBoardColumns board={board} onOpen={openItem} onArchiveDone={archiveDone} />
      )}

      <ZotzTaskDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
