import type { GitHubProjectTable } from '../../../../../shared/github/projects/project-types'
import {
  zotzExternalTaskColumn,
  zotzExternalTaskKey,
  zotzExternalTaskStatus,
  type ZotzExternalTaskSource
} from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import { zotzTasksStatusField } from '../../../../../shared/zotz/tasks/zotz-tasks-contract'
import type { ZotzTaskColumnModel } from './ZotzTaskBoardColumns'

function matches(parts: (string | null | undefined)[], query: string): boolean {
  if (!query) {
    return true
  }
  const haystack = parts.filter(Boolean).join(' ').toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term))
}

export function filterTable(table: GitHubProjectTable, query: string): GitHubProjectTable {
  if (!query) {
    return table
  }
  return {
    ...table,
    rows: table.rows.filter((row) =>
      matches(
        [
          row.content.title,
          row.content.number == null ? null : `#${row.content.number}`,
          row.content.repository,
          table.project.title,
          table.project.owner
        ],
        query
      )
    )
  }
}

export function filterExternalSource(
  source: ZotzExternalTaskSource,
  query: string
): ZotzExternalTaskSource {
  if (!query) {
    return source
  }
  return {
    ...source,
    document: {
      ...source.document,
      tasks: source.document.tasks.filter((task) =>
        matches([task.title, task.id, task.project?.name, source.document.source.name], query)
      )
    }
  }
}

/** A service's own columns: its Status options in order (the parser rejects tasks outside them). */
export function externalSourceColumns(source: ZotzExternalTaskSource): ZotzTaskColumnModel[] {
  const options = zotzTasksStatusField(source.document.source)?.options ?? []
  const columns = options.map((option): ZotzTaskColumnModel => ({
    key: option.id,
    label: option.name,
    color: option.color ?? null,
    description: option.description,
    items: []
  }))
  const byOption = new Map(columns.map((column) => [column.key, column]))
  for (const task of source.document.tasks) {
    const option = zotzExternalTaskStatus(source, task)
    byOption.get(option?.id ?? '')?.items.push({
      key: zotzExternalTaskKey(source.connectorId, task.id),
      title: task.title,
      statusName: option?.name ?? null,
      column: zotzExternalTaskColumn(option),
      origin: { kind: 'external', task, source }
    })
  }
  return columns
}
