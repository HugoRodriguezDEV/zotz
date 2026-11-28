import type { GetProjectViewTableResult } from '../../../shared/github/projects/project-result-types'
import type {
  GitHubProjectFieldValue,
  GitHubProjectRow,
  GitHubProjectTable
} from '../../../shared/github/projects/project-types'
import {
  projectRowStatusName,
  zotzTaskKey
} from '../../../shared/zotz/tasks/zotz-task-board-columns'
import {
  zotzTaskBoardSourceKey,
  zotzTaskBoardSourceLabel,
  type ZotzTaskBoardProjectSource
} from '../../../shared/zotz/tasks/zotz-task-board-types'
import type { ZotzRelayNotice } from '../../../shared/zotz/tasks/zotz-task-relay-types'
import type { ZotzFlowEventDispatcher, ZotzFlowEventPayload } from './zotz-flow-event-dispatch'
import type { ZotzFlowEventMemory } from './zotz-flow-event-memory'
import { zotzFlowFilterMatches, zotzFlowTaskMovedMatches } from './zotz-flow-trigger-match'

const POLL_MS = 2 * 60_000
// Coalesces a burst of relay notices (a drag fires several) into one read.
const RELAY_REREAD_MS = 1500

type ProjectSource = Pick<
  ZotzTaskBoardProjectSource,
  'kind' | 'owner' | 'ownerType' | 'number' | 'title' | 'host'
>

function sourceNames(source: ProjectSource): string[] {
  return [
    zotzTaskBoardSourceKey(source),
    zotzTaskBoardSourceLabel(source),
    source.title,
    `${source.owner}/${source.number}`
  ]
}

/** `github.com/organization/acme/3`, the board's own source key, names a Project not on the board. */
function sourceFromKey(value: string): ProjectSource | null {
  const [host, ownerType, owner, number, extra] = value.trim().split('/')
  const parsed = Number(number)
  if (
    !host ||
    !owner ||
    extra !== undefined ||
    (ownerType !== 'organization' && ownerType !== 'user') ||
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null
  }
  return {
    kind: 'github-project',
    owner,
    ownerType,
    number: parsed,
    title: `${owner}/${parsed}`,
    ...(host === 'github.com' ? {} : { host })
  }
}

function valueText(value: GitHubProjectFieldValue): string | number | null {
  switch (value.kind) {
    case 'single-select':
      return value.name
    case 'iteration':
      return value.title
    case 'text':
      return value.text
    case 'number':
      return value.number
    case 'date':
      return value.date
    case 'labels':
      return value.labels.map((label) => label.name).join(', ')
    case 'users':
      return value.users.map((user) => user.login).join(', ')
  }
}

function rowFields(
  table: GitHubProjectTable,
  row: GitHubProjectRow
): Record<string, string | number | null> {
  const names = new Map(table.selectedView.fields.map((field) => [field.id, field.name]))
  const fields: Record<string, string | number | null> = {
    Repository: row.content.repository,
    Number: row.content.number,
    State: row.content.state
  }
  for (const [fieldId, value] of Object.entries(row.fieldValuesByFieldId)) {
    const name = names.get(fieldId) ?? ('fieldName' in value ? value.fieldName : undefined)
    if (name) {
      fields[name] = valueText(value)
    }
  }
  return fields
}

/** Rows whose column differs from the stored one; rows new since then are not moves. */
export function zotzProjectColumnMoves(
  table: GitHubProjectTable,
  previous: Readonly<Record<string, string>>
): { row: GitHubProjectRow; from: string; to: string }[] {
  return table.rows.flatMap((row) => {
    const from = previous[zotzTaskKey(table.project, row)]
    const to = projectRowStatusName(table, row) ?? ''
    return from === undefined || from === to ? [] : [{ row, from, to }]
  })
}

/**
 * "Task moved" (spec §4.2) for GitHub Projects v2, read in main so it never depends on the board
 * being open: the Projects the enabled flows name (or every board Project when a trigger names
 * none) are read every 2 minutes, and at once on the relay's `projects_v2_item` notices. The
 * column is the board's (the view's column field). The first read only stores the columns; each
 * later change fires once, also across restarts, because the last columns live on disk.
 */
export function watchZotzFlowProjectMoves(deps: {
  dispatcher: ZotzFlowEventDispatcher
  memory: ZotzFlowEventMemory
  /** Projects chosen for the task board (settings). */
  boardProjects: () => ProjectSource[]
  readTable: (source: ProjectSource) => Promise<GetProjectViewTableResult>
  relay: { subscribe: (listener: (notices: readonly ZotzRelayNotice[]) => void) => () => void }
}): () => void {
  const { dispatcher, memory } = deps
  // Project node id → source key, learnt from each read, to reread only the Project a notice names.
  const keyByNodeId = new Map<string, string>()
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let rereadTimer: ReturnType<typeof setTimeout> | null = null
  let reading: Promise<void> = Promise.resolve()

  const watched = (): ProjectSource[] => {
    const triggers = dispatcher.triggers('task_moved')
    const board = deps.boardProjects()
    const picked = board.filter((source) =>
      triggers.some((trigger) => zotzFlowFilterMatches(trigger.source, sourceNames(source)))
    )
    const named = triggers.flatMap((trigger) => {
      const source = trigger.source ? sourceFromKey(trigger.source) : null
      return source ? [source] : []
    })
    return [
      ...new Map(
        [...picked, ...named].map((source) => [zotzTaskBoardSourceKey(source), source])
      ).values()
    ]
  }

  const compare = (source: ProjectSource, table: GitHubProjectTable): void => {
    const key = zotzTaskBoardSourceKey(source)
    keyByNodeId.set(table.project.id, key)
    const previous = memory.readColumns(key)
    memory.writeColumns(
      key,
      Object.fromEntries(
        table.rows.map((row) => [
          zotzTaskKey(table.project, row),
          projectRowStatusName(table, row) ?? ''
        ])
      )
    )
    if (!previous) {
      return
    }
    for (const { row, from, to } of zotzProjectColumnMoves(table, previous)) {
      const payload: ZotzFlowEventPayload<'task_moved'> = {
        kind: 'task_moved',
        task: {
          id: zotzTaskKey(table.project, row),
          title: row.content.title,
          body: row.content.body ?? '',
          fields: rowFields(table, row),
          url: row.content.url
        },
        from,
        to
      }
      const facts = {
        source: [...sourceNames(source), table.project.title, table.project.url],
        project: [table.project.title, row.content.repository],
        from: [from],
        to: [to]
      }
      // A board move names no Zotz session; the hourly cap bounds a flow that moves tasks.
      dispatcher.fire(
        'task_moved',
        payload,
        (trigger) => zotzFlowTaskMovedMatches(trigger, facts),
        null
      )
    }
  }

  // Reads run one after another, so two reads of a Project never compare against the same base.
  const read = (only?: ReadonlySet<string>): Promise<void> => {
    reading = reading.then(async () => {
      if (stopped || !dispatcher.wanted('task_moved')) {
        return
      }
      for (const source of watched()) {
        if (only && !only.has(zotzTaskBoardSourceKey(source))) {
          continue
        }
        const result = await deps.readTable(source).catch((error: unknown) => {
          console.warn('[zotz-flows] could not read a Project:', error)
          return null
        })
        if (stopped) {
          return
        }
        if (result?.ok) {
          compare(source, result.data)
        } else if (result) {
          console.warn(
            `[zotz-flows] could not read ${zotzTaskBoardSourceLabel(source)}:`,
            result.error.message
          )
        }
      }
    })
    return reading
  }

  const loop = (): void => {
    timer = null
    void read().finally(() => {
      if (!stopped) {
        timer = setTimeout(loop, POLL_MS)
        timer.unref?.()
      }
    })
  }

  const pending = new Set<string>()
  let rereadAll = false
  const stopRelay = deps.relay.subscribe((notices) => {
    const items = notices.filter((notice) => notice.kind === 'projects_v2_item')
    if (items.length === 0) {
      return
    }
    for (const notice of items) {
      const key = notice.projectNodeId ? keyByNodeId.get(notice.projectNodeId) : undefined
      if (key) {
        pending.add(key)
      } else {
        rereadAll = true
      }
    }
    if (rereadTimer === null) {
      rereadTimer = setTimeout(() => {
        rereadTimer = null
        const only = rereadAll ? undefined : new Set(pending)
        pending.clear()
        rereadAll = false
        void read(only)
      }, RELAY_REREAD_MS)
      rereadTimer.unref?.()
    }
  })

  loop()
  return () => {
    stopped = true
    stopRelay()
    for (const pendingTimer of [timer, rereadTimer]) {
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer)
      }
    }
  }
}
