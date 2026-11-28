import type { OrchestrationDb } from '../../runtime/orchestration/db/orchestration-db'
import type { ZotzLinkMessage } from '../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { parseOrcaSessionAddress } from '../../../shared/agent-session/identity/orca-session-address'
import { ORCA_SESSION_ADDRESS_PREFIX } from '../../../shared/agent-session/identity/orca-session-address-prefix'

const BRIEF_SUBJECT_MAX = 120
const BRIEF_BODY_MAX = 2000

type DispatchRow = {
  id: string
  run_id: string
  assignee_handle: string | null
  assignee: string | null
  creator: string | null
  coordinator: string | null
  created_at: string
  title: string | null
  spec: string | null
}

type MessageRow = {
  id: string
  from_handle: string
  to_handle: string
  subject: string
  body: string
  type: string
  created_at: string
}

/** SQLite stores `datetime('now')` as UTC without a zone. */
export function parseZotzSqliteTime(value: string): number {
  const parsed = Date.parse(`${value.replace(' ', 'T')}Z`)
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Orchestration mail between known conversations: each dispatch (the worker's brief), and the
 * send, ask/reply and worker_done that follow it. Workers write as `structworker_*` or
 * `dispatch:<id>` and coordinators as `run:<id>`; each maps to the session behind it through the
 * dispatch and run rows. `known` maps every address (and its /clear lineage) to the one asked for.
 */
export function listZotzOrchestrationMail(
  db: OrchestrationDb,
  known: ReadonlyMap<string, string>,
  limit: number
): ZotzLinkMessage[] {
  const ids = [...known.keys()].flatMap((address) => {
    const id = parseOrcaSessionAddress(address)
    return id ? [id] : []
  })
  if (ids.length === 0) {
    return []
  }
  const slots = ids.map(() => '?').join(', ')
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the SELECT names exactly these columns.
  const dispatches = db.db
    .prepare(
      `SELECT d.id, d.run_id, d.assignee_handle, d.created_at,
              d.assignee_orca_session_id AS assignee, d.creator_orca_session_id AS creator,
              r.coordinator_orca_session_id AS coordinator,
              COALESCE(t.display_name, t.task_title) AS title, t.spec
       FROM dispatch_contexts d
       LEFT JOIN runs r ON r.id = d.run_id
       LEFT JOIN tasks t ON t.id = d.task_id
       WHERE d.assignee_orca_session_id IN (${slots})
          OR d.creator_orca_session_id IN (${slots})
          OR r.coordinator_orca_session_id IN (${slots})`
    )
    .all(...ids, ...ids, ...ids) as DispatchRow[]
  const asked = (id: string | null): string | null =>
    id ? (known.get(`${ORCA_SESSION_ADDRESS_PREFIX}${id}`) ?? null) : null
  const handles = new Map<string, string>()
  const remember = (handle: string | null, address: string | null): void => {
    if (handle && address && !handles.has(handle)) {
      handles.set(handle, address)
    }
  }
  const briefs: ZotzLinkMessage[] = []
  for (const row of dispatches) {
    const worker = asked(row.assignee)
    const boss = asked(row.coordinator) ?? asked(row.creator)
    remember(`dispatch:${row.id}`, worker)
    remember(row.assignee_handle, worker)
    remember(`run:${row.run_id}`, boss)
    const from = asked(row.creator) ?? boss
    if (from && worker && from !== worker) {
      const spec = row.spec?.trim() ?? ''
      briefs.push({
        id: `${row.id}:brief`,
        from,
        to: worker,
        fromLabel: null,
        subject: (row.title?.trim() || spec.split('\n')[0] || '').slice(0, BRIEF_SUBJECT_MAX),
        body: spec.slice(0, BRIEF_BODY_MAX),
        type: 'dispatch',
        createdAt: parseZotzSqliteTime(row.created_at)
      })
    }
  }
  if (handles.size === 0) {
    return briefs
  }
  const list = [...handles.keys()]
  const handleSlots = list.map(() => '?').join(', ')
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the SELECT names exactly these columns.
  const rows = db.db
    .prepare(
      `SELECT id, from_handle, to_handle, subject, body, type, created_at
       FROM messages
       WHERE type != 'heartbeat'
         AND (from_handle IN (${handleSlots}) OR to_handle IN (${handleSlots}))
       ORDER BY sequence DESC
       LIMIT ?`
    )
    .all(...list, ...list, limit) as MessageRow[]
  const resolve = (handle: string): string | null =>
    handles.get(handle) ?? known.get(handle) ?? null
  const mail = rows.toReversed().flatMap((row): ZotzLinkMessage[] => {
    const from = resolve(row.from_handle)
    const to = resolve(row.to_handle)
    return from && to && from !== to
      ? [
          {
            id: row.id,
            from,
            to,
            fromLabel: null,
            subject: row.subject,
            body: row.body,
            type: row.type,
            createdAt: parseZotzSqliteTime(row.created_at)
          }
        ]
      : []
  })
  return [...briefs, ...mail]
}
