import { useCallback, useEffect, useMemo, useState } from 'react'
import { useContextualTour } from '../../contextual-tours/use-contextual-tour'
import { toast } from 'sonner'
import { useNow } from '@/hooks/use-now'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store/index'
import ProjectBoard from '../../github-project/board/ProjectBoard'
import {
  zotzTaskKey,
  type ZotzTaskBoardItem
} from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import { distributeZotzTaskItems } from '../../../../../shared/zotz/tasks/zotz-task-board-views'
import {
  readZotzTaskBoardArchived,
  type ZotzTaskBoardArchivedTask,
  zotzTaskBoardSourceKey,
  zotzTaskBoardSourceLabel
} from '../../../../../shared/zotz/tasks/zotz-task-board-types'
import { useZotzTaskBoardData } from './use-zotz-task-board-data'
import { useZotzTaskConnectors } from './use-zotz-task-connectors'
import { useZotzTaskBoardViews } from './use-zotz-task-board-views'
import { useZotzTaskBoardModel } from './use-zotz-task-board-model'
import { useZotzTaskRelay } from './use-zotz-task-relay'
import { useZotzIssueDevelopment, ZotzIssueDevelopmentContext } from './use-zotz-task-development'
import { useZotzTaskWorkspaces, ZotzTaskWorkspacesContext } from './use-zotz-task-workspaces'
import { ZotzTaskBoardColumns, ZotzTaskColumns } from './ZotzTaskBoardColumns'
import { ZotzTaskDetailSheet, type ZotzTaskDetail } from './ZotzTaskDetailSheet'
import { ZotzTaskArchivedList } from './ZotzTaskArchivedList'
import { ZotzTaskTable } from './ZotzTaskTable'
import { ZotzTaskRoadmap } from './ZotzTaskRoadmap'
import { ZotzTaskSlicePanel } from './ZotzTaskSlicePanel'
import { useZotzTaskSummary } from './use-zotz-task-sum'
import { ZotzTaskViewTabs } from './ZotzTaskViewTabs'
import { ZotzTaskBoardToolbar, ZOTZ_TASK_SCOPE_EXTERNAL } from './ZotzTaskBoardToolbar'
import { ZOTZ_TASK_BOARD_SOURCES_SECTION_ID } from './ZotzTaskBoardSourcesSetting'
import { externalSourceColumns } from './zotz-task-board-filtering'
import { ZotzTaskBoardEmpty } from './ZotzTaskBoardEmpty'

/** Clock for relative filters like `updated:@today-7d`; refreshes are timed in useZotzTaskRelay. */
const CLOCK_MS = 5 * 60_000

/** Done tasks not archived yet, stamped now; kept out of render so the clock is read on click. */
function archiveEntries(
  items: readonly ZotzTaskBoardItem[],
  known: ReadonlySet<string>
): ZotzTaskBoardArchivedTask[] {
  const archivedAt = Date.now()
  return items
    .filter((item) => item.column === 'done' && !known.has(item.key))
    .map((item) => ({ key: item.key, title: item.title, archivedAt }))
}

/**
 * The Tasks tab: GitHub Projects, repos and external services in saved views, merged into Zotz's
 * columns or shown as their own source does.
 */
export function ZotzTaskBoard({ active }: { active: boolean }): React.JSX.Element {
  const t = useTranslate()
  const github = useZotzTaskBoardData(active)
  const external = useZotzTaskConnectors(active)
  const views = useZotzTaskBoardViews()
  const workspaces = useZotzTaskWorkspaces()
  const rawArchived = useAppStore((s) => s.settings?.zotzTaskBoardArchived)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const [showArchived, setShowArchived] = useState(false)
  const [detail, setDetail] = useState<ZotzTaskDetail | null>(null)
  const [viewer, setViewer] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  // The picked slice belongs to one view and one "Slice by"; switching either shows all again.
  const [slicePick, setSlicePick] = useState<{
    viewId: string
    sliceBy: string
    value: string | null
  } | null>(null)
  const now = useNow(CLOCK_MS, active)

  const { id: viewId, sliceBy: viewSliceBy } = views.view
  const slice = useMemo(
    () =>
      slicePick && slicePick.viewId === viewId && slicePick.sliceBy === viewSliceBy
        ? { value: slicePick.value }
        : null,
    [slicePick, viewId, viewSliceBy]
  )
  const archived = useMemo(() => readZotzTaskBoardArchived(rawArchived), [rawArchived])
  const archivedKeys = useMemo(() => new Set(archived.map((entry) => entry.key)), [archived])
  const model = useZotzTaskBoardModel({
    githubStates: github.states,
    connectorStates: external.states,
    archivedKeys,
    view: views.view,
    slice,
    viewer,
    now
  })
  const summary = useZotzTaskSummary(views.view.sumField, model.facts)
  const development = useZotzIssueDevelopment(model.items, active, revision)
  const { refresh: refreshGithub } = github
  const { refresh: refreshExternal, syncPullRequests } = external

  useEffect(() => {
    if (active && viewer === null) {
      void window.api?.zotzTaskConnectors?.viewer().then(
        (login) => setViewer(typeof login === 'string' ? login : null),
        () => undefined
      )
    }
  }, [active, viewer])

  const refreshAll = useCallback(() => {
    refreshGithub()
    refreshExternal()
    setRevision((value) => value + 1)
  }, [refreshExternal, refreshGithub])
  const relay = useZotzTaskRelay(active, {
    githubStates: github.states,
    watchedRepos: model.watchedRepos,
    refreshAll,
    refreshSources: github.refreshSources,
    reloadDevelopment: development.reload,
    syncPullRequests
  })

  // Services' PR links follow the repos on the board, so match them after GitHub loads.
  const reposKey = model.repos.join(',')
  useEffect(() => {
    if (active && github.lastUpdatedAt) {
      syncPullRequests(reposKey ? reposKey.split(',') : [])
    }
  }, [active, github.lastUpdatedAt, reposKey, syncPullRequests])

  const openSourceSettings = (): void => {
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
        ? { item, table: model.tablesByProjectId.get(item.origin.project.id) }
        : { item }
    )
  }
  const archiveDone = (items: readonly ZotzTaskBoardItem[]): void => {
    const added = archiveEntries(items, archivedKeys)
    if (added.length > 0) {
      void updateSettings({ zotzTaskBoardArchived: [...archived, ...added] })
    }
  }
  const moveExternal = (itemKey: string, optionId: string): void => {
    const source = model.externalMirror
    const prefix = source ? `external:${source.connectorId}:` : null
    if (!source || !prefix || !itemKey.startsWith(prefix)) {
      return
    }
    void external.move(source.connectorId, itemKey.slice(prefix.length), optionId).then((error) => {
      if (error) {
        toast.error(t('zotz.taskBoard.moveFailed', "Couldn't move the task: {{error}}", { error }))
      }
    })
  }

  const noSources = github.sources.length === 0 && external.states.length === 0
  useContextualTour('zotz-task-board', active && !noSources && model.items.length > 0)
  if (noSources) {
    return <ZotzTaskBoardEmpty active={active} onChooseSources={openSourceSettings} />
  }

  const errors = [
    ...github.states.flatMap((state) =>
      state.error
        ? [
            {
              key: zotzTaskBoardSourceKey(state.source),
              name: zotzTaskBoardSourceLabel(state.source),
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
  const refreshing = github.refreshing || external.refreshing
  const firstLoad = model.items.length === 0 && model.board.archived.length === 0 && refreshing
  const scopes = [
    ...github.sources.map((source) => ({
      value: zotzTaskBoardSourceKey(source),
      label: zotzTaskBoardSourceLabel(source)
    })),
    ...external.states.map(({ connector, snapshot }) => ({
      value: `${ZOTZ_TASK_SCOPE_EXTERNAL}${connector.id}`,
      label: snapshot?.document?.source.name ?? connector.name
    }))
  ]
  const { layout, groupBy, sliceBy } = views.view

  const renderBoard = (): React.ReactNode => {
    if (model.githubMirror && layout === 'board') {
      const table = model.githubMirror
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/50">
          <ProjectBoard
            table={table}
            columnSummary={summary.rows ? (rows) => summary.rows?.(rows, table) : undefined}
            onOpenDialog={(row) =>
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
      )
    }
    if (layout === 'table') {
      return (
        <ZotzTaskTable
          groups={model.groups}
          facts={model.facts}
          sumField={views.view.sumField}
          summarize={summary.items}
          onOpen={openItem}
        />
      )
    }
    if (layout === 'roadmap') {
      return (
        <ZotzTaskRoadmap
          view={views.view}
          groups={model.groups}
          facts={model.facts}
          fields={model.fields}
          now={now}
          summarize={summary.items}
          onUpdate={views.update}
          onOpen={openItem}
        />
      )
    }
    const mirror = model.externalMirror
    const canMove = mirror?.verifiedActions?.includes('move') === true
    const lanes = model.groups.map((group) => {
      const taskIds = new Set(
        group.items.flatMap((item) =>
          item.origin.kind === 'external' ? [item.origin.task.id] : []
        )
      )
      const columns = mirror ? (
        <ZotzTaskColumns
          columns={externalSourceColumns({
            ...mirror,
            document: {
              ...mirror.document,
              tasks: mirror.document.tasks.filter((task) => taskIds.has(task.id))
            }
          })}
          onOpen={openItem}
          canDrag={() => canMove}
          onMove={canMove ? moveExternal : undefined}
          summarize={summary.items}
        />
      ) : (
        <ZotzTaskBoardColumns
          board={distributeZotzTaskItems(group.items)}
          onOpen={openItem}
          onArchiveDone={() => archiveDone(group.items)}
          summarize={summary.items}
        />
      )
      return groupBy === 'none' ? (
        <div key={group.key} className="flex min-h-0 flex-1">
          {columns}
        </div>
      ) : (
        <section key={group.key} className="flex h-80 shrink-0 flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {[
              group.label ?? t('zotz.taskBoard.group.empty', 'None'),
              group.items.length,
              summary.items?.(group.items)
            ]
              .filter((part) => part !== null && part !== undefined)
              .join(' · ')}
          </p>
          {columns}
        </section>
      )
    })
    return groupBy === 'none' ? (
      lanes
    ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scrollbar-sleek">
        {lanes}
      </div>
    )
  }

  return (
    <ZotzIssueDevelopmentContext.Provider value={development.byIssue}>
      <ZotzTaskWorkspacesContext.Provider value={workspaces}>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <ZotzTaskViewTabs state={views} />
          <ZotzTaskBoardToolbar
            state={views}
            scopes={scopes}
            fields={model.fields}
            lastUpdatedAt={github.lastUpdatedAt}
            relayState={relay.state}
            refreshing={refreshing}
            onRefresh={refreshAll}
            archivedCount={archived.length}
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived((value) => !value)}
            onManageSources={openSourceSettings}
          />
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
                void updateSettings({
                  zotzTaskBoardArchived: archived.filter((entry) => entry.key !== key)
                })
              }
            />
          ) : firstLoad ? (
            <p className="px-2 py-6 text-xs text-muted-foreground">
              {t('zotz.taskBoard.loading', 'Loading tasks…')}
            </p>
          ) : sliceBy ? (
            <div className="flex min-h-0 flex-1 gap-2">
              <ZotzTaskSlicePanel
                sliceBy={sliceBy}
                slices={model.slices}
                total={model.sliceTotal}
                active={model.activeSlice}
                onSelect={(pick) =>
                  setSlicePick(pick ? { viewId: views.view.id, sliceBy, value: pick.value } : null)
                }
              />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">{renderBoard()}</div>
            </div>
          ) : (
            renderBoard()
          )}
          <ZotzTaskDetailSheet
            detail={detail}
            onClose={() => setDetail(null)}
            onLinkPullRequest={(item, url) =>
              item.origin.kind === 'external'
                ? external.linkPullRequest(item.origin.source.connectorId, item.origin.task.id, url)
                : undefined
            }
          />
        </div>
      </ZotzTaskWorkspacesContext.Provider>
    </ZotzIssueDevelopmentContext.Provider>
  )
}
