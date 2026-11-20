import type {
  GitHubProjectField,
  GitHubProjectRow,
  GitHubProjectTable
} from '../../github/projects/project-types'
import type { ZotzExternalTask, ZotzTasksSource } from './zotz-tasks-contract'

/** A source field value a view can sum, slice or place on the roadmap. */
export type ZotzTaskFieldValue =
  | { type: 'number'; number: number }
  | { type: 'date'; date: string }
  | { type: 'single-select'; name: string; color: string | null }
  | { type: 'iteration'; title: string; startDate: string; duration: number }

export type ZotzTaskFieldType = ZotzTaskFieldValue['type']

export type ZotzTaskField = { name: string; type: ZotzTaskFieldType }

export type ZotzTaskFieldEntry = { name: string; value: ZotzTaskFieldValue }

/** A task's field values, keyed by lower-cased field name so Projects sharing "Estimate" line up. */
export type ZotzTaskFieldValues = Record<string, ZotzTaskFieldEntry>

export function zotzTaskFieldKey(name: string): string {
  return name.trim().toLowerCase()
}

function viewFieldsById(
  table: Pick<GitHubProjectTable, 'selectedView'> | undefined
): Map<string, GitHubProjectField> {
  const view = table?.selectedView
  if (!view) {
    return new Map()
  }
  const fields = [
    ...view.fields,
    ...view.groupByFields,
    ...view.sortByFields.map((sort) => sort.field),
    ...(view.verticalGroupByFields ?? [])
  ]
  return new Map(fields.map((field) => [field.id, field]))
}

export function githubRowFieldValues(
  row: GitHubProjectRow,
  table?: Pick<GitHubProjectTable, 'selectedView'>
): ZotzTaskFieldValues {
  const byId = viewFieldsById(table)
  const values: ZotzTaskFieldValues = {}
  for (const value of Object.values(row.fieldValuesByFieldId)) {
    const name =
      ('fieldName' in value ? value.fieldName : undefined) ?? byId.get(value.fieldId)?.name
    if (!name) {
      continue
    }
    const typed: ZotzTaskFieldValue | null =
      value.kind === 'number'
        ? { type: 'number', number: value.number }
        : value.kind === 'date'
          ? { type: 'date', date: value.date }
          : value.kind === 'single-select'
            ? { type: 'single-select', name: value.name, color: value.color || null }
            : value.kind === 'iteration'
              ? {
                  type: 'iteration',
                  title: value.title,
                  startDate: value.startDate,
                  duration: value.duration
                }
              : null
    if (typed) {
      values[zotzTaskFieldKey(name)] = { name, value: typed }
    }
  }
  return values
}

export function externalTaskFieldValues(
  task: ZotzExternalTask,
  service: Pick<ZotzTasksSource, 'fields'>
): ZotzTaskFieldValues {
  const values: ZotzTaskFieldValues = {}
  for (const field of service.fields) {
    const raw = task.fieldValues[field.name]
    let typed: ZotzTaskFieldValue | null = null
    if (field.type === 'number' && typeof raw === 'number') {
      typed = { type: 'number', number: raw }
    } else if (field.type === 'date' && typeof raw === 'string' && raw) {
      typed = { type: 'date', date: raw }
    } else if (field.type === 'single-select') {
      const option = field.options.find((entry) => entry.id === raw)
      typed = option
        ? { type: 'single-select', name: option.name, color: option.color ?? null }
        : null
    } else if (field.type === 'iteration') {
      const iteration = field.iterations.find((entry) => entry.id === raw)
      typed = iteration
        ? {
            type: 'iteration',
            title: iteration.title,
            startDate: iteration.startDate,
            duration: iteration.duration
          }
        : null
    }
    if (typed) {
      values[zotzTaskFieldKey(field.name)] = { name: field.name, value: typed }
    }
  }
  return values
}

/**
 * Fields any task in view has a value for, by name and type. Status is left out: the board's
 * own status already slices and groups that.
 */
export function zotzTaskFieldCatalog(taskFields: Iterable<ZotzTaskFieldValues>): ZotzTaskField[] {
  const fields = new Map<string, ZotzTaskField>()
  for (const values of taskFields) {
    for (const [key, entry] of Object.entries(values)) {
      const id = `${key}\0${entry.value.type}`
      if (key !== 'status' && !fields.has(id)) {
        fields.set(id, { name: entry.name, type: entry.value.type })
      }
    }
  }
  return [...fields.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Sum of a number field over tasks; tasks without a value add nothing, like GitHub. */
export function sumZotzTaskField(
  taskFields: Iterable<ZotzTaskFieldValues | undefined>,
  fieldName: string
): number {
  const key = zotzTaskFieldKey(fieldName)
  let total = 0
  for (const values of taskFields) {
    const value = values?.[key]?.value
    if (value?.type === 'number') {
      total += value.number
    }
  }
  return total
}
