import type React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { ZotzAgentRoom, type ZotzRoomAgent } from '../agent-room/ZotzAgentRoom'
import type { ZotzGroupMapEdge, ZotzGroupMapMail } from './zotz-group-map-edges'

/** A group member on the map; `key` is `host\npath`. */
export type ZotzGroupMapNode = ZotzRoomAgent

/**
 * The group as a room of pixel robots: each member in its conversation's color and state, a dotted
 * line per pair that has written to each other, a fainter dashed one from each worker to its
 * parent, and an envelope that flies when new mail (orchestration mail too) lands.
 * Clicking a robot filters the messages to it; where each one stands is saved per group.
 */
export function ZotzGroupMap({
  roomKey,
  nodes,
  edges,
  parentEdges,
  mail,
  selected,
  onSelect
}: {
  /** Saves the robots' spots under this key (`group:<id>`, `family:<root>`); null keeps them for this view only. */
  roomKey: string | null
  nodes: readonly ZotzGroupMapNode[]
  edges: readonly ZotzGroupMapEdge[]
  parentEdges: readonly { child: number; parent: number }[]
  /** Mail that just arrived, with who wrote to whom. */
  mail: readonly ZotzGroupMapMail[]
  /** Key of the member whose messages are shown. */
  selected: string | null
  onSelect: (key: string | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  const keyOf = (index: number): string => nodes[index]?.key ?? ''
  // The room repeats nothing: mail it already flew is skipped by id.
  const links = edges.map((edge) => ({ a: keyOf(edge.a), b: keyOf(edge.b), count: edge.count }))
  const guides = parentEdges.map(({ child, parent }) => ({
    child: keyOf(child),
    parent: keyOf(parent)
  }))
  const roomMail = mail.map((message) => ({
    ...message,
    from: keyOf(message.from),
    to: keyOf(message.to)
  }))
  return (
    <ZotzAgentRoom
      agents={nodes}
      label={t('zotz.groups.mapLabel', 'Who in the group writes to whom')}
      roomKey={roomKey}
      links={links}
      guides={guides}
      mail={roomMail}
      selected={selected}
      onSelect={onSelect}
    />
  )
}
