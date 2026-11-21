import type { ZotzTaskBoard, ZotzTaskBoardItem } from './zotz-task-board-columns'
import type { ZotzTaskFacts } from './zotz-task-filter'

export type ZotzTaskBoardGroupBy = 'none' | 'source' | 'project' | 'assignee' | 'status'
export type ZotzTaskBoardSortBy = 'manual' | 'updated' | 'title'

/** A saved view of the task board, like a GitHub Project view. */
export type ZotzTaskBoardView = {
  id: string
  name: string
  /** "all", a GitHub source key, or "external:<connectorId>". */
  scope: string
  layout: 'board' | 'table'
  filter: string
  groupBy: ZotzTaskBoardGroupBy
  sortBy: ZotzTaskBoardSortBy
}

export const DEFAULT_ZOTZ_TASK_BOARD_VIEW: ZotzTaskBoardView = {
  id: 'all',
  name: 'All',
  scope: 'all',
  layout: 'board',
  filter: '',
  groupBy: 'none',
  sortBy: 'manual'
}

const GROUP_BY: readonly ZotzTaskBoardGroupBy[] = [
  'none',
  'source',
  'project',
  'assignee',
  'status'
]
const SORT_BY: readonly ZotzTaskBoardSortBy[] = ['manual', 'updated', 'title']

function isGroupBy(value: unknown): value is ZotzTaskBoardGroupBy {
  return GROUP_BY.some((item) => item === value)
}

function isSortBy(value: unknown): value is ZotzTaskBoardSortBy {
  return SORT_BY.some((item) => item === value)
}

/** Saved views from settings; there is always at least the built-in "All" view. */
export function readZotzTaskBoardViews(value: unknown): ZotzTaskBoardView[] {
  const views = Array.isArray(value)
    ? value.flatMap((entry: unknown): ZotzTaskBoardView[] => {
        if (typeof entry !== 'object' || entry === null) {
          return []
        }
        const view: Partial<Record<keyof ZotzTaskBoardView, unknown>> = Object.fromEntries(
          Object.entries(entry)
        )
        if (typeof view.id !== 'string' || typeof view.name !== 'string') {
          return []
        }
        return [
          {
            id: view.id,
            name: view.name,
            scope: typeof view.scope === 'string' ? view.scope : 'all',
            layout: view.layout === 'table' ? 'table' : 'board',
            filter: typeof view.filter === 'string' ? view.filter : '',
            groupBy: isGroupBy(view.groupBy) ? view.groupBy : 'none',
            sortBy: isSortBy(view.sortBy) ? view.sortBy : 'manual'
          }
        ]
      })
    : []
  return views.length > 0 ? views : [DEFAULT_ZOTZ_TASK_BOARD_VIEW]
}

export function sortZotzTaskItems(
  items: readonly ZotzTaskBoardItem[],
  facts: ReadonlyMap<string, ZotzTaskFacts>,
  sortBy: ZotzTaskBoardSortBy
): ZotzTaskBoardItem[] {
  if (sortBy === 'manual') {
    return [...items]
  }
  return [...items].sort((a, b) =>
    sortBy === 'title'
      ? a.title.localeCompare(b.title)
      : (facts.get(b.key)?.updatedAt ?? 0) - (facts.get(a.key)?.updatedAt ?? 0)
  )
}

export type ZotzTaskGroup = {
  key: string
  /** null for the "nobody / nothing" group, so the caller can translate it. */
  label: string | null
  items: ZotzTaskBoardItem[]
}

function groupKeys(
  item: ZotzTaskBoardItem,
  facts: ZotzTaskFacts | undefined,
  groupBy: ZotzTaskBoardGroupBy
): (string | null)[] {
  switch (groupBy) {
    case 'source':
      return [
        item.origin.kind === 'github'
          ? item.origin.project.owner
          : item.origin.source.document.source.name
      ]
    case 'project':
      return [
        item.origin.kind === 'github'
          ? item.origin.project.title
          : (item.origin.task.project?.name ?? item.origin.source.document.source.name)
      ]
    case 'assignee':
      return facts && facts.assignees.length > 0 ? facts.assignees : [null]
    case 'status':
      return [item.statusName]
    case 'none':
      return ['']
  }
}

/** Swimlanes like GitHub's "Group by"; a task with two assignees shows in both lanes. */
export function groupZotzTaskItems(
  items: readonly ZotzTaskBoardItem[],
  facts: ReadonlyMap<string, ZotzTaskFacts>,
  groupBy: ZotzTaskBoardGroupBy
): ZotzTaskGroup[] {
  const groups = new Map<string, ZotzTaskGroup>()
  for (const item of items) {
    for (const label of groupKeys(item, facts.get(item.key), groupBy)) {
      const key = label ?? '\0none'
      const group = groups.get(key) ?? { key, label, items: [] }
      group.items.push(item)
      groups.set(key, group)
    }
  }
  return [...groups.values()].sort((a, b) =>
    a.label === null ? 1 : b.label === null ? -1 : a.label.localeCompare(b.label)
  )
}

/** Puts already-filtered items back into the combined board's columns. */
export function distributeZotzTaskItems(
  items: readonly ZotzTaskBoardItem[]
): Pick<ZotzTaskBoard, 'columns' | 'unmapped'> {
  const board: Pick<ZotzTaskBoard, 'columns' | 'unmapped'> = {
    columns: { backlog: [], 'in-progress': [], 'in-review': [], done: [] },
    unmapped: []
  }
  for (const item of items) {
    if (item.column) {
      board.columns[item.column].push(item)
    } else {
      board.unmapped.push(item)
    }
  }
  return board
}

export function flattenZotzTaskBoard(
  board: Pick<ZotzTaskBoard, 'columns' | 'unmapped'>
): ZotzTaskBoardItem[] {
  return [
    ...board.columns.backlog,
    ...board.columns['in-progress'],
    ...board.columns['in-review'],
    ...board.columns.done,
    ...board.unmapped
  ]
}
