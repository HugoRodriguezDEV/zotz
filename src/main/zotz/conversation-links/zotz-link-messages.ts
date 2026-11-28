import type { OrchestrationDb } from '../../runtime/orchestration/db/orchestration-db'
import type {
  ZotzLinkMessage,
  ZotzLinkMessagesParams,
  ZotzLinkMessagesResult
} from '../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import {
  formatOrcaSessionAddress,
  isOrcaSessionId,
  parseOrcaSessionAddress
} from '../../../shared/agent-session/identity/orca-session-address'
import {
  readAgentSessionRecordStore,
  resolveLineageRunningSession,
  type AgentSessionRecordReader
} from '../../runtime/orchestration/addressing/session-lineage/structured-session-lineage'
import { listZotzOrchestrationMail, parseZotzSqliteTime } from './zotz-orchestration-mail'

const DEFAULT_LIMIT = 200

type MessageEndpointRow = {
  id: string
  from_handle: string
  to_handle: string
  subject: string
  body: string
  type: string
  created_at: string
  remote_party: string | null
  sender_label: string | null
}

/** Each address and every later /clear session of it, mapped back to the address asked for. */
function lineageAddresses(
  addresses: readonly string[],
  store: AgentSessionRecordReader | null
): Map<string, string> {
  const result = new Map<string, string>()
  for (const address of addresses) {
    result.set(address, address)
    const id = parseOrcaSessionAddress(address)
    if (!id || !store) {
      continue
    }
    for (const sessionId of resolveLineageRunningSession(store, id).lineage) {
      if (isOrcaSessionId(sessionId) && !result.has(formatOrcaSessionAddress(sessionId))) {
        result.set(formatOrcaSessionAddress(sessionId), address)
      }
    }
  }
  return result
}

/** Mail from another machine is stored under its label, `<address> on <machine>`. */
function labelAddress(handle: string): string | null {
  const at = handle.indexOf(' on ')
  return at > 0 ? handle.slice(0, at) : null
}

/**
 * Mail on this host whose sender and recipient are both linked conversations, or a parent and its
 * workers (orchestration mail included), oldest first.
 */
export function listZotzLinkMessages(
  db: OrchestrationDb,
  params: ZotzLinkMessagesParams,
  store: AgentSessionRecordReader | null = readAgentSessionRecordStore()
): ZotzLinkMessagesResult {
  const known = lineageAddresses(params.addresses, store)
  const list = [...known.keys()]
  const slots = list.map(() => '?').join(', ')
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the SELECT names exactly these columns.
  const rows = db.db
    .prepare(
      `SELECT m.id, m.from_handle, m.to_handle, m.subject, m.body, m.type, m.created_at,
              p.remote_party, p.sender_label
       FROM messages m LEFT JOIN peer_mail_messages p ON p.message_id = m.id
       WHERE m.type != 'heartbeat'
         AND m.to_handle IN (${slots})
         AND (m.from_handle IN (${slots})
              OR p.remote_party IN (${slots})
              OR (instr(m.from_handle, ' on ') > 1
                  AND substr(m.from_handle, 1, instr(m.from_handle, ' on ') - 1) IN (${slots})))
       ORDER BY m.sequence DESC
       LIMIT ?`
    )
    .all(...list, ...list, ...list, ...list, params.limit ?? DEFAULT_LIMIT) as MessageEndpointRow[]
  const messages: ZotzLinkMessage[] = rows.toReversed().map((row) => {
    const peer = row.sender_label !== null
    const from =
      row.remote_party ?? (peer ? labelAddress(row.from_handle) : null) ?? row.from_handle
    return {
      id: row.id,
      from: known.get(from) ?? from,
      to: known.get(row.to_handle) ?? row.to_handle,
      fromLabel: peer ? row.from_handle : null,
      subject: row.subject,
      body: row.body,
      type: row.type,
      createdAt: parseZotzSqliteTime(row.created_at)
    }
  })
  const limit = params.limit ?? DEFAULT_LIMIT
  const byId = new Map(messages.map((message) => [message.id, message]))
  for (const message of listZotzOrchestrationMail(db, known, limit)) {
    if (!byId.has(message.id)) {
      byId.set(message.id, message)
    }
  }
  return {
    messages: [...byId.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-limit)
  }
}
