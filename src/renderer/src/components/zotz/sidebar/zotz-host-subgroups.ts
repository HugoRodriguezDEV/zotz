import type { ExecutionHostId } from '../../../../../shared/execution-host'
import type { ZotzConversationRow } from './zotz-project-conversations'

export type ZotzHostSubgroup = { hostId: ExecutionHostId; conversations: ZotzConversationRow[] }

/** This machine's conversations stay on top; each other machine's go in their own list, in a stable order. */
export function splitZotzRowsByHost(
  rows: readonly ZotzConversationRow[],
  isOtherMachine: (hostId: ExecutionHostId) => boolean
): { here: ZotzConversationRow[]; machines: ZotzHostSubgroup[] } {
  const here: ZotzConversationRow[] = []
  const byHost = new Map<ExecutionHostId, ZotzConversationRow[]>()
  for (const row of rows) {
    if (isOtherMachine(row.hostId)) {
      byHost.set(row.hostId, [...(byHost.get(row.hostId) ?? []), row])
    } else {
      here.push(row)
    }
  }
  const machines = [...byHost]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([hostId, conversations]) => ({ hostId, conversations }))
  return { here, machines }
}
