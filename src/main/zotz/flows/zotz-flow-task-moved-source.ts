import type {
  ZotzExternalTask,
  ZotzTasksDocument
} from '../../../shared/zotz/tasks/zotz-tasks-contract'
import type { ZotzTaskDocumentChange } from '../tasks/zotz-task-document-changes'
import type { ZotzFlowEventDispatcher, ZotzFlowEventPayload } from './zotz-flow-event-dispatch'
import { zotzFlowTaskMovedMatches } from './zotz-flow-trigger-match'

// The board's column field, as the `move` action names it.
const STATUS_FIELD = 'Status'
const FEED_REFRESH_MS = 5 * 60_000

type Column = { id: string; name: string }

export type ZotzFlowTaskMove = {
  task: ZotzExternalTask
  from: Column
  to: Column
}

function columnOf(document: ZotzTasksDocument, task: ZotzExternalTask): Column {
  const value = task.fieldValues[STATUS_FIELD]
  const raw = value === null || value === undefined ? '' : String(value)
  const field = document.source.fields.find(
    (entry) => entry.name === STATUS_FIELD && entry.type === 'single-select'
  )
  const option =
    field?.type === 'single-select'
      ? field.options.find((entry) => entry.id === raw || entry.name === raw)
      : undefined
  return option ? { id: option.id, name: option.name } : { id: raw, name: raw }
}

/** Tasks whose column changed; a first load, new tasks and removed tasks are not moves. */
export function zotzTaskColumnMoves(
  previous: ZotzTasksDocument | null,
  next: ZotzTasksDocument
): ZotzFlowTaskMove[] {
  if (!previous) {
    return []
  }
  const before = new Map(previous.tasks.map((task) => [task.id, task]))
  return next.tasks.flatMap((task) => {
    const old = before.get(task.id)
    if (!old) {
      return []
    }
    const from = columnOf(previous, old)
    const to = columnOf(next, task)
    return from.id === to.id ? [] : [{ task, from, to }]
  })
}

function taskPayload(move: ZotzFlowTaskMove): ZotzFlowEventPayload<'task_moved'> {
  const { task } = move
  return {
    kind: 'task_moved',
    task: {
      id: task.id,
      title: task.title,
      body: task.body ?? '',
      fields: Object.fromEntries(
        Object.entries(task.fieldValues).map(([name, value]) => [
          name,
          typeof value === 'boolean' ? String(value) : value
        ])
      ),
      url: task.url ?? null
    },
    from: move.from.name,
    to: move.to.name
  }
}

/**
 * "Task moved" (spec §4.2) for the external task feeds Zotz reads: every sync and every `move`
 * compares each task's column with the one stored for it. With no board open, URL feeds are
 * re-read every 5 minutes while some flow listens.
 */
export function watchZotzFlowTaskMoves(deps: {
  dispatcher: ZotzFlowEventDispatcher
  onDocumentChanged: (listener: (change: ZotzTaskDocumentChange) => void) => () => void
  refreshFeeds: () => Promise<boolean>
}): () => void {
  const { dispatcher } = deps
  const stopChanges = deps.onDocumentChanged(({ connectorId, previous, next }) => {
    if (!dispatcher.wanted('task_moved')) {
      return
    }
    for (const move of zotzTaskColumnMoves(previous, next)) {
      const facts = {
        source: [connectorId, next.source.id, next.source.name],
        project: [move.task.project?.id, move.task.project?.name],
        from: [move.from.id, move.from.name],
        to: [move.to.id, move.to.name]
      }
      // Board edits are the user's or a service's; no Zotz session is behind them.
      dispatcher.fire(
        'task_moved',
        taskPayload(move),
        (trigger) => zotzFlowTaskMovedMatches(trigger, facts),
        null
      )
    }
  })
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  const loop = (): void => {
    timer = null
    const refresh = dispatcher.wanted('task_moved') ? deps.refreshFeeds() : Promise.resolve(true)
    void refresh
      .catch((error) => console.warn('[zotz-flows] task feeds refresh failed:', error))
      .finally(() => {
        if (!stopped) {
          timer = setTimeout(loop, FEED_REFRESH_MS)
          timer.unref?.()
        }
      })
  }
  timer = setTimeout(loop, FEED_REFRESH_MS)
  timer.unref?.()
  return () => {
    stopped = true
    stopChanges()
    if (timer !== null) {
      clearTimeout(timer)
    }
  }
}
