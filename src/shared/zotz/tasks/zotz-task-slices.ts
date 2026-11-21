import type { ZotzTaskBoardItem } from './zotz-task-board-columns'
import { zotzTaskFieldKey } from './zotz-task-fields'
import type { ZotzTaskFacts } from './zotz-task-filter'

export const ZOTZ_TASK_SLICE_BUILTINS = [
  'assignee',
  'label',
  'status',
  'project',
  'source',
  'repo'
] as const

/** A built-in task attribute, or "field:<name>" for a source's single select or iteration. */
export type ZotzTaskSliceBy = (typeof ZOTZ_TASK_SLICE_BUILTINS)[number] | `field:${string}`

const FIELD_PREFIX = 'field:'

export function isZotzTaskSliceBy(value: unknown): value is ZotzTaskSliceBy {
  return (
    typeof value === 'string' &&
    (ZOTZ_TASK_SLICE_BUILTINS.some((builtin) => builtin === value) ||
      (value.startsWith(FIELD_PREFIX) && value.length > FIELD_PREFIX.length))
  )
}

export function zotzTaskSliceField(sliceBy: ZotzTaskSliceBy): string | null {
  return sliceBy.startsWith(FIELD_PREFIX) ? sliceBy.slice(FIELD_PREFIX.length) : null
}

/**
 * The values a task has for an attribute; null is "no value". Assignees and labels can give
 * several, so the task counts (and groups) under each.
 */
export function zotzTaskValuesFor(
  item: ZotzTaskBoardItem,
  facts: ZotzTaskFacts | undefined,
  by: ZotzTaskSliceBy
): (string | null)[] {
  const many = (values: string[]): (string | null)[] => (values.length > 0 ? values : [null])
  switch (by) {
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
      return many(facts?.assignees ?? [])
    case 'status':
      return [item.statusName]
    case 'label':
      return many(
        (item.origin.kind === 'github'
          ? item.origin.row.content.labels
          : item.origin.task.labels
        ).map((label) => label.name)
      )
    case 'repo':
      return [item.origin.kind === 'github' ? item.origin.row.content.repository : null]
  }
  const field = facts?.fields[zotzTaskFieldKey(zotzTaskSliceField(by) ?? '')]?.value
  return [
    field?.type === 'single-select' ? field.name : field?.type === 'iteration' ? field.title : null
  ]
}

export type ZotzTaskSlice = {
  /** null is the "no value" slice. */
  value: string | null
  count: number
  /** Single-select color token, when the value is an option. */
  color: string | null
}

/**
 * The slice panel's rows: every value tasks have, with how many tasks carry it. Iterations go
 * by start date, everything else by name, and "no value" last.
 */
export function zotzTaskSlices(
  items: readonly ZotzTaskBoardItem[],
  facts: ReadonlyMap<string, ZotzTaskFacts>,
  sliceBy: ZotzTaskSliceBy
): ZotzTaskSlice[] {
  const fieldKey = zotzTaskFieldKey(zotzTaskSliceField(sliceBy) ?? '')
  const slices = new Map<string | null, ZotzTaskSlice & { order: string }>()
  for (const item of items) {
    const itemFacts = facts.get(item.key)
    const field = itemFacts?.fields[fieldKey]?.value
    for (const value of new Set(zotzTaskValuesFor(item, itemFacts, sliceBy))) {
      const slice = slices.get(value) ?? {
        value,
        count: 0,
        color: field?.type === 'single-select' ? field.color : null,
        order: field?.type === 'iteration' ? field.startDate : (value ?? '')
      }
      slice.count += 1
      slices.set(value, slice)
    }
  }
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  return [...slices.values()]
    .sort((a, b) =>
      a.value === null ? 1 : b.value === null ? -1 : collator.compare(a.order, b.order)
    )
    .map(({ value, count, color }) => ({ value, count, color }))
}

export function matchesZotzTaskSlice(
  item: ZotzTaskBoardItem,
  facts: ZotzTaskFacts | undefined,
  sliceBy: ZotzTaskSliceBy,
  value: string | null
): boolean {
  return zotzTaskValuesFor(item, facts, sliceBy).includes(value)
}
