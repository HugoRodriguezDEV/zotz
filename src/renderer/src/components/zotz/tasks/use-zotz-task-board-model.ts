import { useMemo } from 'react'
import type { GitHubProjectTable } from '../../../../../shared/github/projects/project-types'
import {
  buildZotzTaskBoard,
  zotzTaskKey,
  type ZotzExternalTaskSource,
  type ZotzTaskBoard,
  type ZotzTaskBoardItem
} from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import {
  matchesZotzTaskFilter,
  parseZotzTaskFilter,
  zotzTaskFacts,
  type ZotzTaskFacts
} from '../../../../../shared/zotz/tasks/zotz-task-filter'
import {
  flattenZotzTaskBoard,
  groupZotzTaskItems,
  sortZotzTaskItems,
  type ZotzTaskBoardView,
  type ZotzTaskGroup
} from '../../../../../shared/zotz/tasks/zotz-task-board-views'
import { zotzTaskBoardSourceKey } from '../../../../../shared/zotz/tasks/zotz-task-board-types'
import type { ZotzTaskBoardSourceState } from './use-zotz-task-board-data'
import type { ZotzTaskConnectorState } from './use-zotz-task-connectors'
import { ZOTZ_TASK_SCOPE_EXTERNAL } from './ZotzTaskBoardToolbar'

export type ZotzTaskBoardModel = {
  board: ZotzTaskBoard
  tablesByProjectId: ReadonlyMap<string, GitHubProjectTable>
  externalSources: ZotzExternalTaskSource[]
  /** Every task the view shows, after scope, filter and sort. */
  items: ZotzTaskBoardItem[]
  groups: ZotzTaskGroup[]
  facts: ReadonlyMap<string, ZotzTaskFacts>
  /** The view's scope is one GitHub source: shown with its own columns, filtered. */
  githubMirror: GitHubProjectTable | null
  externalMirror: ZotzExternalTaskSource | null
  /** Repos on the board, for matching services' tasks to pull requests. */
  repos: string[]
  /** `repos` plus the ones services declare PRs in: a change there can move their PR links. */
  watchedRepos: string[]
}

/** Scope, filter, sort and grouping of the board for one view; pure derivation of loaded data. */
export function useZotzTaskBoardModel(input: {
  githubStates: readonly ZotzTaskBoardSourceState[]
  connectorStates: readonly ZotzTaskConnectorState[]
  archivedKeys: ReadonlySet<string>
  view: ZotzTaskBoardView
  viewer: string | null
  now: number
}): ZotzTaskBoardModel {
  const { githubStates, connectorStates, archivedKeys, view, viewer, now } = input

  const tables = useMemo(
    () => githubStates.flatMap((state) => (state.table ? [state.table] : [])),
    [githubStates]
  )
  const sourceKeyByProject = useMemo(
    () =>
      new Map(
        githubStates.flatMap((state) =>
          state.table
            ? [[state.table.project.id, zotzTaskBoardSourceKey(state.source)] as const]
            : []
        )
      ),
    [githubStates]
  )
  const tablesByProjectId = useMemo(
    () => new Map(tables.map((table) => [table.project.id, table])),
    [tables]
  )
  const externalSources = useMemo(
    () =>
      connectorStates.flatMap(({ connector, snapshot }): ZotzExternalTaskSource[] =>
        snapshot?.document
          ? [
              {
                connectorId: connector.id,
                document: snapshot.document,
                pullRequests: snapshot.pullRequests,
                verifiedActions: snapshot.verifiedActions
              }
            ]
          : []
      ),
    [connectorStates]
  )
  const board = useMemo(
    () => buildZotzTaskBoard(tables, archivedKeys, externalSources),
    [archivedKeys, externalSources, tables]
  )

  return useMemo(() => {
    const clauses = parseZotzTaskFilter(view.filter)
    const factsOf = (item: ZotzTaskBoardItem): ZotzTaskFacts =>
      zotzTaskFacts(
        item,
        item.origin.kind === 'github' ? tablesByProjectId.get(item.origin.project.id) : undefined
      )
    const inScope = (item: ZotzTaskBoardItem): boolean =>
      view.scope === 'all' ||
      (item.origin.kind === 'github'
        ? sourceKeyByProject.get(item.origin.project.id) === view.scope
        : `${ZOTZ_TASK_SCOPE_EXTERNAL}${item.origin.source.connectorId}` === view.scope)

    const facts = new Map<string, ZotzTaskFacts>()
    const visible = flattenZotzTaskBoard(board).filter((item) => {
      if (!inScope(item)) {
        return false
      }
      const itemFacts = factsOf(item)
      facts.set(item.key, itemFacts)
      return matchesZotzTaskFilter(itemFacts, clauses, viewer, now)
    })
    const items = sortZotzTaskItems(visible, facts, view.sortBy)
    const groups =
      view.groupBy === 'none'
        ? [{ key: '', label: '', items }]
        : groupZotzTaskItems(items, facts, view.groupBy)

    // A single GitHub source keeps its own columns; its rows are filtered without board dedupe.
    const mirrorTable =
      githubStates.find((state) => zotzTaskBoardSourceKey(state.source) === view.scope)?.table ??
      null
    const githubMirror = mirrorTable
      ? {
          ...mirrorTable,
          rows: mirrorTable.rows.filter((row) =>
            matchesZotzTaskFilter(
              zotzTaskFacts(
                {
                  key: zotzTaskKey(mirrorTable.project, row),
                  title: row.content.title,
                  statusName: null,
                  column: null,
                  origin: { kind: 'github', row, project: mirrorTable.project }
                },
                mirrorTable
              ),
              clauses,
              viewer,
              now
            )
          )
        }
      : null
    const externalMirror =
      externalSources.find(
        (source) => `${ZOTZ_TASK_SCOPE_EXTERNAL}${source.connectorId}` === view.scope
      ) ?? null
    const repos = [
      ...new Set(
        tables.flatMap((table) =>
          table.rows.flatMap((row) => (row.content.repository ? [row.content.repository] : []))
        )
      )
    ]
    const watchedRepos = [
      ...new Set([
        ...repos,
        ...externalSources.flatMap((source) =>
          source.document.tasks.flatMap((task) =>
            task.pullRequests.map((pullRequest) => pullRequest.repo)
          )
        )
      ])
    ]
    return {
      board,
      tablesByProjectId,
      externalSources,
      items,
      groups,
      facts,
      githubMirror,
      externalMirror,
      repos,
      watchedRepos
    }
  }, [
    board,
    externalSources,
    githubStates,
    now,
    sourceKeyByProject,
    tables,
    tablesByProjectId,
    view,
    viewer
  ])
}
