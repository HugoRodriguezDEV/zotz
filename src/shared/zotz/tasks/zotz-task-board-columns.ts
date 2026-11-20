import { resolveBoardColumnField } from '../../github/projects/project-board-columns'
import type { GitHubProjectRow, GitHubProjectTable } from '../../github/projects/project-types'
import {
  zotzTasksStatusField,
  type ZotzExternalTask,
  type ZotzTasksDocument,
  type ZotzTasksStatusOption
} from './zotz-tasks-contract'

export type ZotzTaskBoardColumnId = 'backlog' | 'in-progress' | 'in-review' | 'done'

export type ZotzTaskBoardColumn = {
  id: ZotzTaskBoardColumnId
  label: string
  /** GitHub single-select color token, so columns read like a Project's Status options. */
  color: string
}

export const ZOTZ_TASK_BOARD_COLUMNS: readonly ZotzTaskBoardColumn[] = [
  { id: 'backlog', label: 'Backlog', color: 'GRAY' },
  { id: 'in-progress', label: 'In Progress', color: 'YELLOW' },
  { id: 'in-review', label: 'In Review', color: 'PURPLE' },
  { id: 'done', label: 'Done', color: 'GREEN' }
]

const STATUS_SYNONYMS: Record<ZotzTaskBoardColumnId, readonly string[]> = {
  backlog: [
    'backlog',
    'todo',
    'to do',
    'ready',
    'new',
    'triage',
    'icebox',
    'planned',
    'por hacer',
    'pendiente'
  ],
  'in-progress': ['in progress', 'doing', 'started', 'wip', 'active', 'en progreso', 'en curso'],
  'in-review': [
    'in review',
    'review',
    'code review',
    'ready for review',
    'qa',
    'testing',
    'validation',
    'en revision'
  ],
  done: ['done', 'closed', 'complete', 'completed', 'shipped', 'released', 'resolved', 'terminado']
}

/**
 * Word prefixes for status names nobody listed above, like "✅ Completado" or "Pendiente por
 * priorizar". Checked in this order, so "Ready for review" lands in review, not backlog.
 */
const STATUS_KEYWORDS: readonly (readonly [ZotzTaskBoardColumnId, readonly string[]])[] = [
  [
    'done',
    [
      'done',
      'complet',
      'termin',
      'finaliz',
      'cerrad',
      'closed',
      'resuel',
      'resolved',
      'hecho',
      'shipped',
      'released'
    ]
  ],
  ['in-review', ['review', 'revis', 'qa', 'test', 'prueba', 'validat', 'validac', 'aprob']],
  ['in-progress', ['progres', 'doing', 'curso', 'wip', 'desarroll', 'working', 'trabajando']],
  [
    'backlog',
    [
      'backlog',
      'todo',
      'pendiente',
      'hacer',
      'ready',
      'triage',
      'priori',
      'nuevo',
      'new',
      'icebox',
      'plan'
    ]
  ]
]

function normalizeStatusName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Matches a source's status option to a Zotz column by name, then synonyms, then keywords. */
export function zotzTaskBoardColumnForStatus(
  name: string | null | undefined
): ZotzTaskBoardColumnId | null {
  if (!name) {
    return null
  }
  const normalized = normalizeStatusName(name)
  for (const column of ZOTZ_TASK_BOARD_COLUMNS) {
    if (normalizeStatusName(column.label) === normalized) {
      return column.id
    }
  }
  for (const column of ZOTZ_TASK_BOARD_COLUMNS) {
    if (STATUS_SYNONYMS[column.id].includes(normalized)) {
      return column.id
    }
  }
  const words = normalized.split(' ')
  for (const [column, keywords] of STATUS_KEYWORDS) {
    if (keywords.some((keyword) => words.some((word) => word.startsWith(keyword)))) {
      return column
    }
  }
  return null
}

/** The row's value in the field its project's board groups columns by (Status by default). */
export function projectRowStatusName(
  table: GitHubProjectTable,
  row: GitHubProjectRow
): string | null {
  const field = resolveBoardColumnField(table.selectedView)
  if (!field) {
    return null
  }
  const value = row.fieldValuesByFieldId[field.id]
  if (value?.kind === 'single-select') {
    return value.name
  }
  if (value?.kind === 'iteration') {
    return value.title
  }
  return null
}

export type ZotzExternalTaskSource = {
  /** The Zotz connector the document came from, so two services can reuse task ids. */
  connectorId: string
  document: ZotzTasksDocument
}

export type ZotzTaskBoardItem = {
  /** Stable across projects, so the same issue on two boards is one card and one archive entry. */
  key: string
  title: string
  statusName: string | null
  column: ZotzTaskBoardColumnId | null
  origin:
    | { kind: 'github'; row: GitHubProjectRow; project: GitHubProjectTable['project'] }
    | { kind: 'external'; task: ZotzExternalTask; source: ZotzExternalTaskSource }
}

export type ZotzTaskBoard = {
  columns: Record<ZotzTaskBoardColumnId, ZotzTaskBoardItem[]>
  /** Items whose status matches no Zotz column, like a Project's "No Status". */
  unmapped: ZotzTaskBoardItem[]
  /** Archived items still in Done, hidden from the board. */
  archived: ZotzTaskBoardItem[]
}

export function zotzTaskKey(project: GitHubProjectTable['project'], row: GitHubProjectRow): string {
  return row.content.url ?? `${project.url}#${row.id}`
}

export function zotzExternalTaskKey(connectorId: string, taskId: string): string {
  return `external:${connectorId}:${taskId}`
}

const CATEGORY_COLUMNS: Record<ZotzTasksStatusOption['category'] & string, ZotzTaskBoardColumnId> =
  {
    todo: 'backlog',
    'in-progress': 'in-progress',
    done: 'done'
  }

/** The option a task's Status points at; the parser already checked that it exists. */
export function zotzExternalTaskStatus(
  source: ZotzExternalTaskSource,
  task: ZotzExternalTask
): ZotzTasksStatusOption | null {
  const field = zotzTasksStatusField(source.document.source)
  return field?.options.find((option) => option.id === task.fieldValues.Status) ?? null
}

/** A service's own status name wins; its declared category is the fallback for names we can't read. */
export function zotzExternalTaskColumn(
  option: ZotzTasksStatusOption | null
): ZotzTaskBoardColumnId | null {
  if (!option) {
    return null
  }
  return (
    zotzTaskBoardColumnForStatus(option.name) ??
    (option.category ? CATEGORY_COLUMNS[option.category] : null)
  )
}

function place(board: ZotzTaskBoard, item: ZotzTaskBoardItem, archivedKeys: ReadonlySet<string>) {
  if (item.column === 'done' && archivedKeys.has(item.key)) {
    board.archived.push(item)
  } else if (item.column) {
    board.columns[item.column].push(item)
  } else {
    board.unmapped.push(item)
  }
}

/**
 * Merges project tables in source order, then external services. The first copy of an issue
 * wins, and a PR that an issue on the board already links is shown on that issue instead of
 * as its own card.
 */
export function buildZotzTaskBoard(
  tables: readonly GitHubProjectTable[],
  archivedKeys: ReadonlySet<string>,
  externalSources: readonly ZotzExternalTaskSource[] = []
): ZotzTaskBoard {
  const board: ZotzTaskBoard = {
    columns: { backlog: [], 'in-progress': [], 'in-review': [], done: [] },
    unmapped: [],
    archived: []
  }
  const linkedPullRequestUrls = new Set<string>()
  for (const table of tables) {
    for (const row of table.rows) {
      for (const pullRequest of row.content.linkedPullRequests?.pullRequests ?? []) {
        linkedPullRequestUrls.add(pullRequest.url)
      }
    }
  }
  const seen = new Set<string>()
  for (const table of tables) {
    for (const row of table.rows) {
      const key = zotzTaskKey(table.project, row)
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      if (row.itemType === 'PULL_REQUEST' && linkedPullRequestUrls.has(row.content.url ?? '')) {
        continue
      }
      const statusName = projectRowStatusName(table, row)
      place(
        board,
        {
          key,
          title: row.content.title,
          statusName,
          column: zotzTaskBoardColumnForStatus(statusName),
          origin: { kind: 'github', row, project: table.project }
        },
        archivedKeys
      )
    }
  }
  for (const source of externalSources) {
    for (const task of source.document.tasks) {
      const option = zotzExternalTaskStatus(source, task)
      place(
        board,
        {
          key: zotzExternalTaskKey(source.connectorId, task.id),
          title: task.title,
          statusName: option?.name ?? null,
          column: zotzExternalTaskColumn(option),
          origin: { kind: 'external', task, source }
        },
        archivedKeys
      )
    }
  }
  return board
}
