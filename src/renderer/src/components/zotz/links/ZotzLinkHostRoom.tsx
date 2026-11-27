import { useState } from 'react'
import type React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import type { ZotzConversationEntry } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { ZotzAgentRoom, type ZotzRoomAgent } from '../agent-room/ZotzAgentRoom'
import type { ZotzGroupMapData } from './use-zotz-group-map'
import type { ZotzLinkHost } from './use-zotz-link-data'
import { ZotzLinkAgentCard } from './ZotzLinkAgentCard'

/** Same `host\npath` key the group map uses, so the group's lines and mail land on these robots. */
export function zotzHostRoomKey(hostId: string, path: string): string {
  return `${hostId}\n${path}`
}

/**
 * One machine's conversations as a room of robots. Picking one shows its card below with the
 * link action; double click or Enter opens it. Lines and mail come from the open group's map.
 */
export function ZotzLinkHostRoom({
  host,
  entries,
  groupMap,
  isCurrent,
  isInGroup,
  actionFor,
  onOpen
}: {
  host: ZotzLinkHost
  entries: readonly ZotzConversationEntry[]
  groupMap: Pick<ZotzGroupMapData, 'nodes' | 'edges' | 'mail'>
  isCurrent: (entry: ZotzConversationEntry) => boolean
  isInGroup: (entry: ZotzConversationEntry) => boolean
  actionFor: (entry: ZotzConversationEntry) => React.ReactNode
  onOpen: (entry: ZotzConversationEntry) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [selected, setSelected] = useState<string | null>(null)
  const keyOf = (entry: ZotzConversationEntry): string => zotzHostRoomKey(host.hostId, entry.path)
  const byKey = new Map(entries.map((entry) => [keyOf(entry), entry]))
  const agents = entries.map((entry): ZotzRoomAgent => ({
    key: keyOf(entry),
    label: entry.shortName,
    state: entry.state,
    agent: entry.agent,
    inGroup: isInGroup(entry),
    machine: host.isThisDevice ? null : host.name,
    current: isCurrent(entry)
  }))
  const memberKey = (index: number): string | null => {
    const key = groupMap.nodes[index]?.key
    return key && byKey.has(key) ? key : null
  }
  const links = groupMap.edges.flatMap((edge) => {
    const a = memberKey(edge.a)
    const b = memberKey(edge.b)
    return a && b ? [{ a, b, count: edge.count }] : []
  })
  const mail = groupMap.mail.flatMap((message) => {
    const from = memberKey(message.from)
    const to = memberKey(message.to)
    return from && to ? [{ ...message, from, to }] : []
  })
  const picked = selected ? (byKey.get(selected) ?? null) : null
  const open = (key: string): void => {
    const entry = byKey.get(key)
    if (entry) {
      onOpen(entry)
    }
  }
  return (
    <div className="space-y-1.5 px-1">
      <ZotzAgentRoom
        agents={agents}
        label={t('zotz.links.hostRoom', 'Conversations on {{host}}', { host: host.name })}
        roomKey={`machine:${host.hostId}`}
        links={links}
        mail={mail}
        selected={picked ? selected : null}
        onSelect={setSelected}
        onOpen={open}
      />
      {picked ? (
        <ZotzLinkAgentCard
          entry={picked}
          inGroup={isInGroup(picked)}
          action={actionFor(picked)}
          onOpen={() => onOpen(picked)}
        />
      ) : null}
    </div>
  )
}
