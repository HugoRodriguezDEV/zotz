import {
  zotzExternalTaskColumn,
  zotzExternalTaskKey,
  zotzExternalTaskStatus,
  type ZotzExternalTaskSource
} from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import { zotzTasksStatusField } from '../../../../../shared/zotz/tasks/zotz-tasks-contract'
import type { ZotzTaskColumnModel } from './ZotzTaskBoardColumns'

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
