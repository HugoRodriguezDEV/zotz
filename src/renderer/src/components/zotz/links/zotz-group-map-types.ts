import type { ZotzConversationState } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { ZotzGroupMapEdge } from './zotz-group-map-edges'

export type ZotzGroupMapNode = {
  /** `host\npath`: stable across renders and restarts. */
  key: string
  /** Short name of the conversation. */
  label: string
  /** Machine name when the member lives on another machine. */
  machine: string | null
  state: ZotzConversationState | null
  /** The conversation open in this window. */
  current: boolean
}

/** Saved spots by member key, as fractions of the stage. */
export type ZotzGroupMapPositions = Readonly<Record<string, readonly [number, number]>>

export type ZotzGroupMapStageInput = {
  nodes: readonly ZotzGroupMapNode[]
  edges: readonly ZotzGroupMapEdge[]
  parentEdges: readonly { child: number; parent: number }[]
  selected: string | null
  positions: ZotzGroupMapPositions | undefined
  reduced: boolean
  height: number
}

export type ZotzGroupMapStageCallbacks = {
  onSelect: (key: string | null) => void
  onPositionsChange: (positions: Record<string, [number, number]>) => void
  /** Keeps each agent's focusable overlay on top of its robot. */
  place: (key: string, x: number, y: number) => void
}
