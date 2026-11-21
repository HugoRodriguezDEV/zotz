import {
  parseRoadmapDate,
  ROADMAP_DAY_MS,
  type RoadmapSpan
} from '../../github/projects/project-roadmap-timeline'
import {
  zotzTaskFieldKey,
  type ZotzTaskField,
  type ZotzTaskFieldValue,
  type ZotzTaskFieldValues
} from './zotz-task-fields'

const START_FIELD = /start|begin|kick.?off|inicio|comienzo/i
const END_FIELD = /target|end|due|finish|deadline|ship|fin|entrega|limite|límite/i

/** The days a date (one day) or an iteration (its whole length) covers, end exclusive. */
function fieldRange(value: ZotzTaskFieldValue | undefined): RoadmapSpan | null {
  if (value?.type === 'date') {
    const start = parseRoadmapDate(value.date)
    return start === null ? null : { startMs: start, endMs: start + ROADMAP_DAY_MS, point: true }
  }
  if (value?.type === 'iteration') {
    const start = parseRoadmapDate(value.startDate)
    const days = value.duration > 0 ? value.duration : 1
    return start === null
      ? null
      : { startMs: start, endMs: start + days * ROADMAP_DAY_MS, point: false }
  }
  return null
}

/**
 * Where a task's bar goes: from the start field to the end field. With only one date the bar is
 * a one-day marker; an iteration alone spans the iteration. Reversed dates still make a bar.
 */
export function zotzTaskRoadmapSpan(
  fields: ZotzTaskFieldValues,
  startField: string | null,
  endField: string | null
): RoadmapSpan | null {
  const start = startField ? fieldRange(fields[zotzTaskFieldKey(startField)]?.value) : null
  const end = endField ? fieldRange(fields[zotzTaskFieldKey(endField)]?.value) : null
  if (start && end) {
    return {
      startMs: Math.min(start.startMs, end.startMs),
      endMs: Math.max(start.endMs, end.endMs),
      point: false
    }
  }
  return start ?? end
}

/**
 * Fields a roadmap uses when the view hasn't picked any: a start/end pair of dates by name, else
 * the first two dates, else an iteration, else a single date.
 */
export function zotzTaskRoadmapDefaultFields(fields: readonly ZotzTaskField[]): {
  start: string | null
  end: string | null
} {
  const dates = fields.filter((field) => field.type === 'date')
  const start = dates.find((field) => START_FIELD.test(field.name))
  const end = dates.find((field) => field !== start && END_FIELD.test(field.name))
  if (start && end) {
    return { start: start.name, end: end.name }
  }
  const [first, second] = dates
  if (first && second) {
    return start === second || end === first
      ? { start: second.name, end: first.name }
      : { start: first.name, end: second.name }
  }
  const iteration = fields.find((field) => field.type === 'iteration')
  if (iteration) {
    return { start: iteration.name, end: null }
  }
  return { start: first?.name ?? null, end: null }
}
