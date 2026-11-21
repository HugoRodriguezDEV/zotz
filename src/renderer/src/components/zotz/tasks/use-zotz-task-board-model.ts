import { useMemo } from 'react'
import type { GitHubProjectTable } from '../../../../../shared/github/projects/project-types'
import {
  buildZotzTaskBoard,
  projectRowStatusName,
  zotzTaskBoardColumnForStatus,
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
import {
  zotzTaskFieldCatalog,
  type ZotzTaskField
} from '../../../../../shared/zotz/tasks/zotz-task-fields'
import {
  matchesZotzTaskSlice,
  zotzTaskSlices,
  type ZotzTaskSlice
} from '../../../../../shared/zotz/tasks/zotz-task-slices'
import type { ZotzTaskBoardSourceState } from './use-zotz-task-board-data'
import type { ZotzTaskConnectorState } from './use-zotz-task-connectors'
import { ZOTZ_TASK_SCOPE_EXTERNAL } from './ZotzTaskBoardToolbar'

export type ZotzTaskBoardModel = {
  board: ZotzTaskBoard
  tablesByProjectId: ReadonlyMap<string, GitHubProjectTable>
  externalSources: ZotzExternalTaskSource[]
  /** Every task the view shows, after scope, filter, slice and sort. */
  items: ZotzTaskBoardItem[]
  groups: ZotzTaskGroup[]
  facts: ReadonlyMap<string, ZotzTaskFacts>
  /** The view's scope is one GitHub source: shown with its own columns, filtered. */
  githubMirror: GitHubProjectTable | null
  externalMirror: ZotzExternalTaskSource | null
  /** Repos on the board, for matching services' tasks to pull requests. */
  repos: string[]
  /** Source fields tasks in scope have, for the view's sum, slice and roadmap pickers. */
  fields: ZotzTaskField[]
  /** The slice panel's rows, counted after the written filter; empty without "Slice by". */
  slices: ZotzTaskSlice[]
  /** The picked slice, or null for "All" (also when the picked value no longer exists). */
  activeSlice: { value: string | null } | null
  /** Tasks the filter lets through, before the slice: the panel's "All" count. */
  sliceTotal: number
}

/** A GitHub row as a board item, for filtering and slicing a Project's own view. */
function githubRowItem(
  table: GitHubProjectTable,
  row: GitHubProjectTable['rows'][number]
): ZotzTaskBoardItem {
  const statusName = projectRowStatusName(table, row)
  return {
    key: zotzTaskKey(table.project, row),
    title: row.content.title,
    statusName,
    column: zotzTaskBoardColumnForStatus(statusName),
    origin: { kind: 'github', row, project: table.project }
  }
}

/** Scope, filter, sort and grouping of the board for one view; pure derivation of loaded data. */
export function useZotzTaskBoardModel(input: {
  githubStates: readonly ZotzTaskBoardSourceState[]
  connectorStates: readonly ZotzTaskConnectorState[]
  archivedKeys: ReadonlySet<string>
  view: ZotzTaskBoardView
  /** The slice value picked in the panel; null shows all. */
  slice: { value: string | null } | null
  viewer: string | null
  now: number
}): ZotzTaskBoardModel {
  const { githubStates, connectorStates, archivedKeys, view, slice, viewer, now } = input

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
    const filtered = flattenZotzTaskBoard(board).filter((item) => {
      if (!inScope(item)) {
        return false
      }
      const itemFacts = factsOf(item)
      facts.set(item.key, itemFacts)
      return matchesZotzTaskFilter(itemFacts, clauses, viewer, now)
    })
    const fields = zotzTaskFieldCatalog([...facts.values()].map((entry) => entry.fields))

    // A single GitHub source keeps its own columns; its rows are filtered without board dedupe.
    const mirrorTable =
      githubStates.find((state) => zotzTaskBoardSourceKey(state.source) === view.scope)?.table ??
      null
    const mirrorRows = mirrorTable
      ? mirrorTable.rows.flatMap((row) => {
          const item = githubRowItem(mirrorTable, row)
          const rowFacts = zotzTaskFacts(item, mirrorTable)
          return matchesZotzTaskFilter(rowFacts, clauses, viewer, now)
            ? [{ row, item, facts: rowFacts }]
            : []
        })
      : []
    // The Project's own board counts its own rows, so slice counts match what it shows.
    const slicedByMirror = mirrorTable !== null && view.layout === 'board'
    const sliceBy = view.sliceBy
    const slices = sliceBy
      ? slicedByMirror
        ? zotzTaskSlices(
            mirrorRows.map((entry) => entry.item),
            new Map(mirrorRows.map((entry) => [entry.item.key, entry.facts])),
            sliceBy
          )
        : zotzTaskSlices(filtered, facts, sliceBy)
      : []
    const activeSlice =
      sliceBy && slice && slices.some((entry) => entry.value === slice.value) ? slice : null
    const inSlice = (item: ZotzTaskBoardItem, itemFacts: ZotzTaskFacts | undefined): boolean =>
      !sliceBy || !activeSlice || matchesZotzTaskSlice(item, itemFacts, sliceBy, activeSlice.value)

    const visible = filtered.filter((item) => inSlice(item, facts.get(item.key)))
    const items = sortZotzTaskItems(visible, facts, view.sortBy)
    const groups =
      view.groupBy === 'none'
        ? [{ key: '', label: '', items }]
        : groupZotzTaskItems(items, facts, view.groupBy)
    const githubMirror = mirrorTable
      ? {
          ...mirrorTable,
          rows: mirrorRows.flatMap((entry) => (inSlice(entry.item, entry.facts) ? [entry.row] : []))
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
      fields,
      slices,
      activeSlice,
      sliceTotal: slicedByMirror ? mirrorRows.length : filtered.length
    }
  }, [
    board,
    externalSources,
    githubStates,
    now,
    slice,
    sourceKeyByProject,
    tables,
    tablesByProjectId,
    view,
    viewer
  ])
}
