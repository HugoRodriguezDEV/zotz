import { resolveBoardColumnField } from '../../github/projects/project-board-columns'
import type { GitHubProjectTable } from '../../github/projects/project-types'
import { ZOTZ_TASK_BOARD_COLUMNS, type ZotzTaskBoardItem } from './zotz-task-board-columns'

/** What a filter can ask about a task, the same for GitHub and external sources. */
export type ZotzTaskFacts = {
  text: string
  state: 'open' | 'closed' | 'merged'
  type: 'issue' | 'pr' | 'draft'
  status: string | null
  column: string | null
  assignees: string[]
  labels: string[]
  repo: string | null
  project: string
  source: string[]
  updatedAt: number | null
  iterations: { startDate: string; duration: number }[]
}

export function zotzTaskFacts(
  item: ZotzTaskBoardItem,
  table?: Pick<GitHubProjectTable, 'selectedView'>
): ZotzTaskFacts {
  const column = ZOTZ_TASK_BOARD_COLUMNS.find((entry) => entry.id === item.column)?.label ?? null
  if (item.origin.kind === 'github') {
    const { row, project } = item.origin
    const field = table ? resolveBoardColumnField(table.selectedView) : null
    const statusValue = field ? row.fieldValuesByFieldId[field.id] : undefined
    const state = (row.content.state ?? 'OPEN').toLowerCase()
    return {
      text: [
        row.content.title,
        row.content.number == null ? '' : `#${row.content.number}`,
        row.content.repository ?? ''
      ]
        .join(' ')
        .toLowerCase(),
      state: state === 'merged' ? 'merged' : state === 'closed' ? 'closed' : 'open',
      type:
        row.itemType === 'PULL_REQUEST' ? 'pr' : row.itemType === 'DRAFT_ISSUE' ? 'draft' : 'issue',
      status: item.statusName ?? (statusValue?.kind === 'single-select' ? statusValue.name : null),
      column,
      assignees: row.content.assignees.map((user) => user.login.toLowerCase()),
      labels: row.content.labels.map((label) => label.name.toLowerCase()),
      repo: row.content.repository?.toLowerCase() ?? null,
      project: project.title.toLowerCase(),
      source: ['github', project.owner.toLowerCase()],
      updatedAt: Date.parse(row.updatedAt) || null,
      iterations: Object.values(row.fieldValuesByFieldId).flatMap((value) =>
        value.kind === 'iteration' ? [{ startDate: value.startDate, duration: value.duration }] : []
      )
    }
  }
  const { task, source } = item.origin
  const service = source.document.source
  const iterationField = service.fields.flatMap((field) =>
    field.type === 'iteration' ? [field] : []
  )
  return {
    text: [task.title, task.id, task.project?.name ?? ''].join(' ').toLowerCase(),
    state: task.state,
    type: task.type === 'draft' ? 'draft' : 'issue',
    status: item.statusName,
    column,
    assignees: task.assignees.map((person) => person.login.toLowerCase()),
    labels: task.labels.map((label) => label.name.toLowerCase()),
    repo: null,
    project: (task.project?.name ?? service.name).toLowerCase(),
    source: [
      service.id.toLowerCase(),
      service.name.toLowerCase(),
      source.connectorId.toLowerCase()
    ],
    updatedAt: task.updatedAt ? Date.parse(task.updatedAt) || null : null,
    iterations: iterationField.flatMap((field) => {
      const value = task.fieldValues[field.name]
      const iteration = field.iterations.find((entry) => entry.id === value)
      return iteration ? [{ startDate: iteration.startDate, duration: iteration.duration }] : []
    })
  }
}

type Clause = { negate: boolean; qualifier: string | null; values: string[] }

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"') && value.length > 1
    ? value.slice(1, -1)
    : value
}

export function parseZotzTaskFilter(filter: string): Clause[] {
  const clauses: Clause[] = []
  for (const match of filter.matchAll(/(-?)([\w-]+):("[^"]*"|\S+)|(-?)("[^"]*"|\S+)/g)) {
    if (match[2]) {
      clauses.push({
        negate: match[1] === '-',
        qualifier: match[2].toLowerCase(),
        values: unquote(match[3] ?? '')
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      })
    } else if (match[5]) {
      clauses.push({
        negate: match[4] === '-',
        qualifier: null,
        values: [unquote(match[5]).toLowerCase()]
      })
    }
  }
  return clauses
}

const DAY_MS = 86_400_000

/** "@today-7d", "@today-2w", "@today-1m" or "@today" → start of that day. */
function relativeDay(value: string, now: number): number | null {
  const match = /^@today(?:-(\d+)([dwm]))?$/.exec(value)
  if (!match) {
    return null
  }
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const amount = Number(match[1] ?? 0)
  const days = match[2] === 'w' ? amount * 7 : match[2] === 'm' ? amount * 30 : amount
  return today.getTime() - days * DAY_MS
}

function matchesUpdated(value: string, updatedAt: number | null, now: number): boolean {
  if (updatedAt === null) {
    return false
  }
  const parts = /^(>=|<=|>|<)?(.*)$/.exec(value)
  const operator = parts?.[1] ?? '>='
  const day = relativeDay(parts?.[2] ?? '', now)
  if (day === null) {
    return true
  }
  switch (operator) {
    case '>':
      return updatedAt >= day + DAY_MS
    case '<':
      return updatedAt < day
    case '<=':
      return updatedAt < day + DAY_MS
    default:
      return updatedAt >= day
  }
}

function matchesIteration(value: string, facts: ZotzTaskFacts, now: number): boolean {
  const offset =
    value === '@previous' ? -1 : value === '@next' ? 1 : value === '@current' ? 0 : null
  if (offset === null) {
    return true
  }
  return facts.iterations.some(({ startDate, duration }) => {
    const start = Date.parse(`${startDate}T00:00:00`)
    const length = duration * DAY_MS
    const target = now + offset * length
    return target >= start && target < start + length
  })
}

function matchesClause(
  clause: Clause,
  facts: ZotzTaskFacts,
  viewer: string | null,
  now: number
): boolean {
  const any = (predicate: (value: string) => boolean): boolean => clause.values.some(predicate)
  const field = (name: string): boolean =>
    name === 'assignee'
      ? facts.assignees.length > 0
      : name === 'label'
        ? facts.labels.length > 0
        : name === 'status'
          ? facts.status !== null
          : name === 'repo'
            ? facts.repo !== null
            : true
  switch (clause.qualifier) {
    case null:
      return any((value) => facts.text.includes(value))
    case 'is':
      return any((value) => value === facts.state || value === facts.type)
    case 'status':
      return any(
        (value) => value === facts.status?.toLowerCase() || value === facts.column?.toLowerCase()
      )
    case 'assignee':
      return any((value) =>
        facts.assignees.includes(value === '@me' ? (viewer ?? '') : value.replace(/^@/, ''))
      )
    case 'label':
      return any((value) => facts.labels.includes(value))
    case 'repo':
      return any((value) => facts.repo === value)
    case 'project':
      return any((value) => facts.project.includes(value))
    case 'source':
      return any((value) => facts.source.includes(value))
    case 'no':
      return any((value) => !field(value))
    case 'has':
      return any((value) => field(value))
    case 'updated':
      return any((value) => matchesUpdated(value, facts.updatedAt, now))
    case 'iteration':
      return any((value) => matchesIteration(value, facts, now))
    default:
      // Unknown qualifiers are ignored, like GitHub does with ones a view doesn't support.
      return true
  }
}

/** True when the task passes every clause; repeated qualifiers AND together, commas OR. */
export function matchesZotzTaskFilter(
  facts: ZotzTaskFacts,
  clauses: readonly Clause[],
  viewer: string | null,
  now: number
): boolean {
  return clauses.every((clause) => matchesClause(clause, facts, viewer, now) !== clause.negate)
}
